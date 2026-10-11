// ============================================================
// ILI9341 2.4" TFT Driver — Ultra-Simple Bit-Bang
// Fills screen GREEN. Confirmed working pinout:
//   SCK=T13, MOSI=R10, DC=R11, RST=N9, CS=P9
// SPI = 390 kHz (very conservative)
// ============================================================
module ili9341_driver (
    input  wire         clk,          // 100 MHz
    input  wire         rst_n,
    input  wire [7:0]   conf_pct,
    input  wire [159:0] label,
    input  wire         result_valid,
    output reg          tft_sck,
    output reg          tft_sdi,
    output reg          tft_dc,
    output reg          tft_reset,
    output reg          tft_cs
);
    // ── 1 ms tick counter ────────────────────────────────────
    localparam MS = 100_000;          // 100MHz / 1000 = 100k cycles per ms
    localparam HALF_BIT = 128;        // ~390 kHz SPI

    // ── State encoding ────────────────────────────────────────
    localparam [3:0]
        ST_RST    = 0,   // hold RESET low
        ST_WAIT   = 1,   // wait after reset
        ST_CMD    = 2,   // send command/data byte
        ST_DELAY  = 3,   // ms-level delay
        ST_FILL   = 4,   // fill screen pixels
        ST_IDLE   = 5;   // done

    reg [3:0]  state = ST_RST;
    reg [26:0] timer  = 0;    // general timer
    reg [26:0] ms_cnt = 0;    // ms delay counter
    reg [26:0] ms_tgt = 0;    // ms delay target
    reg [3:0]  next_state = ST_WAIT; // after delay

    // SPI byte sending
    reg [7:0]  byte_buf = 0;
    reg [2:0]  bit_pos  = 7;
    reg [7:0]  clk_cnt  = 0;
    reg        sending   = 0;
    reg [3:0]  after_cmd = ST_CMD;  // state to return to after byte sent

    // Pixel counter
    reg [31:0] px = 0;

    // ── Sequencer: list of (dc, byte) pairs to send ──────────
    // We hard-code a flat sequence with DC and byte inline
    // Format: {valid[15], dc[14], byte[7:0]}  special: 16'hF000 = DELAY_150MS
    // We use a big case statement for zero-risk of ROM synthesis issues

    reg [4:0] seq_idx = 0;
    reg [15:0] seq_out;
    always @(*) begin
        case (seq_idx)
            // CMD SWRESET
            5'd0:  seq_out = 16'h8001;  // dc=0 cmd=0x01
            5'd1:  seq_out = 16'hF096;  // DELAY 150ms (0x96=150)
            // CMD SLPOUT
            5'd2:  seq_out = 16'h8011;  // dc=0 cmd=0x11
            5'd3:  seq_out = 16'hF0FF;  // DELAY 255ms
            // COLMOD 16-bit
            5'd4:  seq_out = 16'h803A;
            5'd5:  seq_out = 16'h0055;  // dc=1 dat=0x55
            // MADCTL portrait
            5'd6:  seq_out = 16'h8036;
            5'd7:  seq_out = 16'h0048;
            // CASET 0..239
            5'd8:  seq_out = 16'h802A;
            5'd9:  seq_out = 16'h0000;
            5'd10: seq_out = 16'h0000;
            5'd11: seq_out = 16'h0000;
            5'd12: seq_out = 16'h00EF;
            // RASET 0..319
            5'd13: seq_out = 16'h802B;
            5'd14: seq_out = 16'h0000;
            5'd15: seq_out = 16'h0000;
            5'd16: seq_out = 16'h0001;
            5'd17: seq_out = 16'h003F;
            // NORON
            5'd18: seq_out = 16'h8013;
            // INVOFF
            5'd19: seq_out = 16'h8020;
            // DISPON
            5'd20: seq_out = 16'h8029;
            5'd21: seq_out = 16'hF019;  // DELAY 25ms
            // RAMWR — then fill pixels
            5'd22: seq_out = 16'h802C;
            5'd23: seq_out = 16'hFFFF;  // END marker → go to fill
            default: seq_out = 16'hFFFF;
        endcase
    end

    // ── SPI bit-bang sender ───────────────────────────────────
    reg        send_req  = 0;   // pulse to start sending byte_buf
    reg        send_busy = 0;
    reg [2:0]  sbit      = 7;
    reg [7:0]  sclk_div  = 0;
    reg        clk_phase = 0;

    // ── Main FSM ──────────────────────────────────────────────
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state      <= ST_RST;
            tft_reset  <= 0;
            tft_cs     <= 1;
            tft_dc     <= 1;
            tft_sck    <= 0;
            tft_sdi    <= 0;
            timer      <= 0;
            ms_cnt     <= 0;
            ms_tgt     <= 0;
            seq_idx    <= 0;
            px         <= 0;
            send_req   <= 0;
            send_busy  <= 0;
            sbit       <= 7;
            sclk_div   <= 0;
            clk_phase  <= 0;
            byte_buf   <= 0;
        end else begin

            // ─────────────────────────────────────────────────
            // SPI bit-bang engine (runs alongside FSM)
            // ─────────────────────────────────────────────────
            if (send_req) begin
                send_req  <= 0;
                send_busy <= 1;
                sbit      <= 7;
                sclk_div  <= 0;
                clk_phase <= 0;
                tft_sck   <= 0;
                tft_sdi   <= byte_buf[7];
            end else if (send_busy) begin
                sclk_div <= sclk_div + 1;
                if (sclk_div == HALF_BIT - 1) begin
                    sclk_div  <= 0;
                    clk_phase <= ~clk_phase;
                    if (!clk_phase) begin
                        // Rising edge
                        tft_sck <= 1;
                    end else begin
                        // Falling edge — advance bit
                        tft_sck <= 0;
                        if (sbit == 0) begin
                            send_busy <= 0;  // byte done
                        end else begin
                            sbit    <= sbit - 1;
                            tft_sdi <= byte_buf[sbit - 1];
                        end
                    end
                end
            end

            // ─────────────────────────────────────────────────
            // Main FSM
            // ─────────────────────────────────────────────────
            case (state)

                // ── RESET: pull RST low 20ms ─────────────────
                ST_RST: begin
                    tft_reset <= 0;
                    tft_cs    <= 1;
                    if (timer < MS * 20)
                        timer <= timer + 1;
                    else begin
                        timer     <= 0;
                        tft_reset <= 1;
                        state     <= ST_WAIT;
                    end
                end

                // ── WAIT: 150ms after reset ──────────────────
                ST_WAIT: begin
                    if (timer < MS * 150)
                        timer <= timer + 1;
                    else begin
                        timer   <= 0;
                        tft_cs  <= 0;  // CS LOW for entire init
                        seq_idx <= 0;
                        state   <= ST_CMD;
                    end
                end

                // ── CMD: process sequencer ────────────────────
                ST_CMD: begin
                    if (!send_busy) begin
                        if (seq_out == 16'hFFFF) begin
                            // End → go to pixel fill
                            px    <= 0;
                            state <= ST_FILL;
                        end else if (seq_out[15:8] == 8'hF0) begin
                            // Delay in ms = seq_out[7:0]
                            ms_tgt  <= seq_out[7:0];  // approx ms
                            timer   <= 0;
                            seq_idx <= seq_idx + 1;
                            state   <= ST_DELAY;
                        end else begin
                            // Send byte
                            tft_dc   <= ~seq_out[15];  // bit15=1→cmd→DC=0
                            byte_buf <= seq_out[7:0];
                            send_req <= 1;
                            seq_idx  <= seq_idx + 1;
                            // Stay in ST_CMD, will re-check !send_busy next cycle
                        end
                    end
                end

                // ── DELAY: wait ms_tgt ms ─────────────────────
                ST_DELAY: begin
                    if (timer < ms_tgt * MS)
                        timer <= timer + 1;
                    else begin
                        timer <= 0;
                        state <= ST_CMD;
                    end
                end

                // ── FILL: write 153600 bytes of bright green ──
                // GREEN = 0x07E0: HI=0x07 LO=0xE0
                ST_FILL: begin
                    tft_dc <= 1;  // data
                    tft_cs <= 0;
                    if (!send_busy && !send_req) begin
                        byte_buf <= px[0] ? 8'hE0 : 8'h07;  // GREEN HI/LO
                        send_req <= 1;
                        if (px < 32'd153599)
                            px <= px + 1;
                        else
                            state <= ST_IDLE;
                    end
                end

                ST_IDLE: begin
                    tft_cs <= 1;
                    // Screen stays green — update when result_valid
                end

            endcase
        end
    end

endmodule
