// ============================================================
// OV7670 Camera Capture — FPGA Verilog
// Captures one QQVGA (160x120) RGB565 frame into BRAM
// then signals ready for UART transmission
//
// OV7670 Pins (from EDGE Artix-7 XDC):
//   sioc   M16   SCCB clock (I2C SCL)
//   siod   N16   SCCB data  (I2C SDA)
//   vsync  P15   Vertical sync
//   href   P16   Horizontal reference
//   pclk   R15   Pixel clock (input from camera)
//   xclk   R16   System clock to camera (25 MHz output)
//   data   T14,T15,N13,P13,N14,P14,P10,P11  [7:0]
//   reset  R12   Camera reset (active low)
//   pwdn   T12   Power down (active high)
// ============================================================
module camera_capture (
    input  wire        clk,          // 100 MHz system clock
    input  wire        rst_n,
    input  wire        capture_en,   // pulse to start capture

    // OV7670 interface
    output wire        cam_xclk,     // 25 MHz clock to camera
    input  wire        cam_pclk,     // pixel clock from camera
    input  wire        cam_vsync,    // vertical sync
    input  wire        cam_href,     // horizontal reference
    input  wire [7:0]  cam_data,     // pixel data
    output wire        cam_reset,    // camera reset (active-low)
    output wire        cam_pwdn,     // power down (active-high=off)

    // SCCB (I2C-like) for camera config
    output wire        sccb_clk,
    inout  wire        sccb_dat,

    // Frame buffer output (to UART sender)
    output reg  [7:0]  pixel_out,
    output reg         pixel_valid,
    output reg         frame_done,   // one-cycle pulse when frame ready
    output reg         frame_busy    // high during capture
);
    // ----------------------------------------------------------
    // XCLK: 25 MHz from 100 MHz (divide by 4)
    // ----------------------------------------------------------
    reg [1:0] xclk_div = 0;
    reg       xclk_r   = 0;

    always @(posedge clk) begin
        xclk_div <= xclk_div + 1;
        if (xclk_div == 2'd1) xclk_r <= 1;
        if (xclk_div == 2'd3) xclk_r <= 0;
    end

    assign cam_xclk = xclk_r;
    assign cam_reset = rst_n;      // camera reset follows system reset
    assign cam_pwdn  = 1'b0;       // always powered on

    // ----------------------------------------------------------
    // SCCB Master — writes OV7670 registers at startup
    // We configure: QQVGA 160x120, RGB565 output
    // ----------------------------------------------------------
    sccb_master u_sccb (
        .clk     (clk),
        .rst_n   (rst_n),
        .sccb_clk(sccb_clk),
        .sccb_dat(sccb_dat)
    );

    // ----------------------------------------------------------
    // Frame capture FSM
    // OV7670 outputs RGB565 as two bytes per pixel:
    //   First byte:  R[4:0] G[5:3]
    //   Second byte: G[2:0] B[4:0]
    // At QQVGA (160x120), total = 160*120*2 = 38,400 bytes
    // ----------------------------------------------------------
    localparam CAP_IDLE   = 2'd0;
    localparam CAP_WAIT_V = 2'd1;   // wait for vsync falling
    localparam CAP_FRAME  = 2'd2;   // capture pixels
    localparam CAP_DONE   = 2'd3;

    reg [1:0]  cap_state;
    reg        vsync_prev;
    reg        href_prev;

    // Pixel byte counter (2 bytes per pixel)
    reg [16:0] byte_cnt;   // 0 to 38399
    localparam FRAME_BYTES = 17'd38400;  // 160*120*2

    // Synchronize camera signals to system clock
    reg pclk_s0, pclk_s1, pclk_s2;
    reg href_s, vsync_s;
    reg [7:0] data_s;

    always @(posedge clk) begin
        pclk_s0  <= cam_pclk;
        pclk_s1  <= pclk_s0;
        pclk_s2  <= pclk_s1;
        href_s   <= cam_href;
        vsync_s  <= cam_vsync;
        data_s   <= cam_data;
    end

    // Rising edge of pclk in system clock domain
    wire pclk_rise = pclk_s1 & ~pclk_s2;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            cap_state  <= CAP_IDLE;
            vsync_prev <= 0;
            byte_cnt   <= 0;
            pixel_valid<= 0;
            frame_done <= 0;
            frame_busy <= 0;
            pixel_out  <= 0;
        end else begin
            pixel_valid <= 0;
            frame_done  <= 0;
            vsync_prev  <= vsync_s;

            case (cap_state)
                CAP_IDLE: begin
                    frame_busy <= 0;
                    if (capture_en) begin
                        frame_busy <= 1;
                        byte_cnt   <= 0;
                        cap_state  <= CAP_WAIT_V;
                    end
                end

                // Wait for vsync rising edge (start of new frame)
                CAP_WAIT_V: begin
                    if (vsync_s && !vsync_prev)
                        cap_state <= CAP_FRAME;
                end

                // Capture pixel bytes when href is high
                CAP_FRAME: begin
                    if (pclk_rise && href_s) begin
                        pixel_out   <= data_s;
                        pixel_valid <= 1;
                        byte_cnt    <= byte_cnt + 1;
                        if (byte_cnt >= FRAME_BYTES - 1) begin
                            cap_state <= CAP_DONE;
                        end
                    end
                    // If vsync goes high again, frame ended early
                    if (vsync_s && !vsync_prev)
                        cap_state <= CAP_IDLE;
                end

                CAP_DONE: begin
                    frame_done <= 1;
                    frame_busy <= 0;
                    cap_state  <= CAP_IDLE;
                end
            endcase
        end
    end

endmodule
