// ============================================================
// TOP-LEVEL MODULE v2 — 3EDGE Artix-7 XC7A35T
// OV7670 Camera → BRAM Frame Buffer → UART → PC Python Bridge
// PC returns AI result → UART → TFT display + LEDs
//
// Stream flow:
//   1. BTN0 pulse OR auto-timer triggers camera capture
//   2. OV7670 fills frame_buffer BRAM (38400 bytes)
//   3. UART sender sends: 0xAA 0x55 [W_hi][W_lo][H_hi][H_lo] + pixels
//   4. PC Python bridge receives, runs inference via FastAPI
//   5. PC sends back: 0xBB [len] [label] [conf%] 0xCC
//   6. result_parser decodes → TFT + LEDs update
// ============================================================
module top (
    input  wire        clk,         // 100 MHz

    input  wire        btn_capture, // BTN0 K13 — trigger capture
    input  wire        btn_rst,     // BTN1 L14 — system reset

    output wire [3:0]  led,         // LED[0]=idle,[1]=capturing,[2]=sending,[3]=result

    // TFT ILI9341
    output wire        tft_sck,
    output wire        tft_sdi,
    output wire        tft_dc,
    output wire        tft_reset,
    output wire        tft_cs,

    // USB-UART (FT2232H Channel B → COM4 on PC)
    output wire        esp_tx,      // FPGA → PC  (D4)
    input  wire        esp_rx,      // PC → FPGA  (C4)

    // OV7670 Camera
    output wire        cam_xclk,
    input  wire        cam_pclk,
    input  wire        cam_vsync,
    input  wire        cam_href,
    input  wire [7:0]  cam_data,
    output wire        cam_reset,
    output wire        cam_pwdn,

    // SCCB (I2C-like) for camera config
    output wire        sccb_clk,
    inout  wire        sccb_dat
);

    // ── Reset ───────────────────────────────────────────────
    wire rst_n = ~btn_rst;

    // ── State machine ───────────────────────────────────────
    localparam SM_IDLE     = 3'd0;
    localparam SM_CAPTURE  = 3'd1;
    localparam SM_HEADER   = 3'd2;
    localparam SM_SEND     = 3'd3;
    localparam SM_WAIT     = 3'd4;
    localparam SM_RESULT   = 3'd5;

    reg [2:0] state;

    // ── Button debounce ─────────────────────────────────────
    reg [19:0] db_cnt;
    reg        btn_prev, btn_debounced, btn_pulse;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            db_cnt <= 0; btn_prev <= 0; btn_pulse <= 0;
        end else begin
            btn_pulse <= 0;
            if (btn_capture == btn_prev) db_cnt <= 0;
            else begin
                db_cnt <= db_cnt + 1;
                if (db_cnt == 20'd1_000_000) begin
                    btn_prev <= btn_capture;
                    if (btn_capture) btn_pulse <= 1'b1;
                end
            end
        end
    end

    // ── Auto-capture timer (every 2 seconds) ────────────────
    reg [27:0] auto_cnt;
    reg        auto_pulse;
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            auto_cnt <= 0; auto_pulse <= 0;
        end else begin
            auto_pulse <= 0;
            auto_cnt   <= auto_cnt + 1;
            if (auto_cnt == 28'd200_000_000) begin  // 2 seconds at 100MHz
                auto_cnt  <= 0;
                if (state == SM_IDLE)
                    auto_pulse <= 1'b1;
            end
        end
    end

    wire trigger = btn_pulse | auto_pulse;

    // ── Camera capture ──────────────────────────────────────
    wire       cam_pixel_valid;
    wire [7:0] cam_pixel_out;
    wire       cam_frame_done;
    wire       cam_frame_busy;
    reg        capture_en;

    camera_capture u_cam (
        .clk        (clk),
        .rst_n      (rst_n),
        .capture_en (capture_en),
        .cam_xclk   (cam_xclk),
        .cam_pclk   (cam_pclk),
        .cam_vsync  (cam_vsync),
        .cam_href   (cam_href),
        .cam_data   (cam_data),
        .cam_reset  (cam_reset),
        .cam_pwdn   (cam_pwdn),
        .sccb_clk   (sccb_clk),
        .sccb_dat   (sccb_dat),
        .pixel_out  (cam_pixel_out),
        .pixel_valid(cam_pixel_valid),
        .frame_done (cam_frame_done),
        .frame_busy (cam_frame_busy)
    );

    // ── Frame buffer (BRAM 38400 bytes) ─────────────────────
    reg  [15:0] wr_addr;
    wire [7:0]  rd_data;
    reg  [15:0] rd_addr;
    reg         rd_en;

    frame_buffer u_fbuf (
        .wr_clk  (clk),
        .wr_en   (cam_pixel_valid && state == SM_CAPTURE),
        .wr_addr (wr_addr),
        .wr_data (cam_pixel_out),
        .rd_clk  (clk),
        .rd_en   (rd_en),
        .rd_addr (rd_addr),
        .rd_data (rd_data)
    );

    // ── UART TX ─────────────────────────────────────────────
    reg  [7:0] uart_tx_byte;
    reg        uart_tx_valid;
    wire       uart_tx_busy;

    uart_tx #(.CLK_FREQ(100_000_000), .BAUD_RATE(921_600)) u_tx (
        .clk       (clk),
        .rst_n     (rst_n),
        .data_in   (uart_tx_byte),
        .data_valid(uart_tx_valid),
        .tx        (esp_tx),
        .busy      (uart_tx_busy)
    );

    // ── UART RX ─────────────────────────────────────────────
    wire [7:0] rx_byte;
    wire       rx_valid;

    uart_rx #(.CLK_FREQ(100_000_000), .BAUD_RATE(921_600)) u_rx (
        .clk       (clk),
        .rst_n     (rst_n),
        .rx        (esp_rx),
        .data_out  (rx_byte),
        .data_valid(rx_valid)
    );

    // ── Result parser ────────────────────────────────────────
    wire [159:0] label;
    wire [7:0]   conf_pct;
    wire         result_valid;

    result_parser u_parser (
        .clk         (clk),
        .rst_n       (rst_n),
        .rx_byte     (rx_byte),
        .rx_valid    (rx_valid),
        .label       (label),
        .conf_pct    (conf_pct),
        .result_valid(result_valid)
    );

    // ── TFT display ──────────────────────────────────────────
    ili9341_driver u_tft (
        .clk         (clk),
        .rst_n       (rst_n),
        .conf_pct    (conf_pct),
        .label       (label),
        .result_valid(result_valid),
        .tft_sck     (tft_sck),
        .tft_sdi     (tft_sdi),
        .tft_dc      (tft_dc),
        .tft_reset   (tft_reset),
        .tft_cs      (tft_cs)
    );

    // ── Frame header (6 bytes: AA 55 00 A0 00 78) ────────────
    // Width=160=0x00A0, Height=120=0x0078
    localparam HDR_LEN = 6;
    reg [2:0] hdr_idx;
    reg [7:0] hdr_byte;
    always @(*) begin
        case (hdr_idx)
            3'd0: hdr_byte = 8'hAA;
            3'd1: hdr_byte = 8'h55;
            3'd2: hdr_byte = 8'h00;  // width hi
            3'd3: hdr_byte = 8'hA0;  // width lo (160)
            3'd4: hdr_byte = 8'h00;  // height hi
            3'd5: hdr_byte = 8'h78;  // height lo (120)
            default: hdr_byte = 8'h00;
        endcase
    end

    // ── Timeout counter ──────────────────────────────────────
    reg [27:0] timeout_cnt;

    // ── Main state machine ──────────────────────────────────
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state         <= SM_IDLE;
            capture_en    <= 0;
            uart_tx_valid <= 0;
            wr_addr       <= 0;
            rd_addr       <= 0;
            rd_en         <= 0;
            hdr_idx       <= 0;
            timeout_cnt   <= 0;
        end else begin
            uart_tx_valid <= 0;
            capture_en    <= 0;
            rd_en         <= 0;

            case (state)
                // ─────────────────────────────────────────
                SM_IDLE: begin
                    if (trigger) begin
                        wr_addr <= 0;
                        capture_en <= 1'b1;
                        state   <= SM_CAPTURE;
                    end
                end

                // ─────────────────────────────────────────
                SM_CAPTURE: begin
                    // Write camera pixels into BRAM
                    if (cam_pixel_valid) begin
                        wr_addr <= wr_addr + 1;
                    end
                    if (cam_frame_done) begin
                        // Frame complete — start sending header
                        hdr_idx <= 0;
                        state   <= SM_HEADER;
                    end
                end

                // ─────────────────────────────────────────
                SM_HEADER: begin
                    if (!uart_tx_busy && !uart_tx_valid) begin
                        uart_tx_byte  <= hdr_byte;
                        uart_tx_valid <= 1'b1;
                        if (hdr_idx < HDR_LEN - 1)
                            hdr_idx <= hdr_idx + 1;
                        else begin
                            rd_addr <= 0;
                            state   <= SM_SEND;
                        end
                    end
                end

                // ─────────────────────────────────────────
                SM_SEND: begin
                    // Drain BRAM → UART
                    if (!uart_tx_busy && !uart_tx_valid) begin
                        rd_en <= 1'b1;  // latch read (data available next cycle)
                    end
                    if (rd_en) begin
                        uart_tx_byte  <= rd_data;
                        uart_tx_valid <= 1'b1;
                        rd_addr       <= rd_addr + 1;
                        rd_en         <= 0;
                        if (rd_addr >= 16'd38399) begin
                            timeout_cnt <= 0;
                            state       <= SM_WAIT;
                        end
                    end
                end

                // ─────────────────────────────────────────
                SM_WAIT: begin
                    // Wait for PC result (up to 10 seconds)
                    if (result_valid)
                        state <= SM_RESULT;
                    else begin
                        timeout_cnt <= timeout_cnt + 1;
                        if (timeout_cnt == 28'd100_000_000) begin  // 1 second
                            timeout_cnt <= 0;
                            state       <= SM_IDLE;  // timeout
                        end
                    end
                end

                // ─────────────────────────────────────────
                SM_RESULT: begin
                    state <= SM_IDLE;
                end

            endcase
        end
    end

    // ── LEDs ────────────────────────────────────────────────
    assign led[0] = (state == SM_IDLE);
    assign led[1] = (state == SM_CAPTURE);
    assign led[2] = (state == SM_HEADER || state == SM_SEND);
    assign led[3] = (state == SM_RESULT) || result_valid;

endmodule
