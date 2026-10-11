// ============================================================
// SCCB Master — OV7670 Register Configuration
// SCCB is I2C-compatible at 100kHz
// Configures OV7670 for: QQVGA (160x120), RGB565, 30fps
// ============================================================
module sccb_master (
    input  wire clk,       // 100 MHz
    input  wire rst_n,
    output reg  sccb_clk,
    inout  wire sccb_dat
);
    // OV7670 SCCB address
    localparam OV7670_ADDR = 8'h42;  // write address

    // SCCB clock: 100 kHz from 100 MHz = divide by 1000
    localparam CLK_DIV = 500;  // half-period

    // Register init table: {reg_addr, reg_val}
    // Minimal set for QQVGA RGB565
    localparam REG_LEN = 24;
    reg [15:0] reg_rom [0:REG_LEN-1];
    initial begin
        reg_rom[0]  = 16'h1280;  // COM7: reset all
        reg_rom[1]  = 16'hFFFF;  // DELAY
        reg_rom[2]  = 16'h1204;  // COM7: RGB, QQVGA
        reg_rom[3]  = 16'h1180;  // CLKRC: prescaler /2 → ~15fps
        reg_rom[4]  = 16'h0C00;  // COM3: no scale, no DCW
        reg_rom[5]  = 16'h3E00;  // COM14: no PCLK divider
        reg_rom[6]  = 16'h7003;  // SCALING_XSC
        reg_rom[7]  = 16'h7103;  // SCALING_YSC
        reg_rom[8]  = 16'h7200;  // SCALING_DCWCTR
        reg_rom[9]  = 16'h7310;  // SCALING_PCLK_DIV: /2
        reg_rom[10] = 16'hA200;  // SCALING_PCLK_DELAY
        // RGB565 format
        reg_rom[11] = 16'h4010;  // COM15: RGB565, full range
        reg_rom[12] = 16'h8C00;  // RGB444: off
        // Windowing for QQVGA (160x120)
        reg_rom[13] = 16'h1732;  // HSTART
        reg_rom[14] = 16'h18B6;  // HSTOP
        reg_rom[15] = 16'h3200;  // HREF
        reg_rom[16] = 16'h1910;  // VSTART
        reg_rom[17] = 16'h1A7A;  // VSTOP
        reg_rom[18] = 16'h030A;  // VREF
        // Disable test pattern
        reg_rom[19] = 16'h7000;  // SCALING_XSC: no test
        reg_rom[20] = 16'h7100;  // SCALING_YSC: no test
        // Auto white balance & exposure
        reg_rom[21] = 16'h13E7;  // COM8: AEC, AWB, AGC on
        reg_rom[22] = 16'h0E61;  // COM5
        reg_rom[23] = 16'hFFFF;  // END marker
    end

    // ── FSM ─────────────────────────────────────────────────
    localparam SS_IDLE    = 3'd0;
    localparam SS_DELAY   = 3'd1;
    localparam SS_START   = 3'd2;
    localparam SS_ADDR    = 3'd3;
    localparam SS_REG     = 3'd4;
    localparam SS_VAL     = 3'd5;
    localparam SS_STOP    = 3'd6;
    localparam SS_DONE    = 3'd7;

    reg [2:0]  state;
    reg [4:0]  reg_idx;
    reg [9:0]  clk_cnt;
    reg        clk_phase;
    reg [7:0]  shift;
    reg [2:0]  bit_pos;
    reg        sdat_oe;    // 1 = drive, 0 = release (high-Z)
    reg        sdat_out;
    reg [19:0] delay_cnt;

    assign sccb_dat = sdat_oe ? sdat_out : 1'bz;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state     <= SS_IDLE;
            sccb_clk  <= 1;
            sdat_oe   <= 1;
            sdat_out  <= 1;
            reg_idx   <= 0;
            clk_cnt   <= 0;
            delay_cnt <= 0;
        end else begin

            // ── Initial power-on delay (100ms) ────────────
            if (state == SS_IDLE) begin
                if (delay_cnt < 20'd10_000_000) begin
                    delay_cnt <= delay_cnt + 1;
                    sccb_clk  <= 1;
                    sdat_out  <= 1;
                end else begin
                    reg_idx <= 0;
                    state   <= SS_DELAY;
                end
            end

            // ── Inter-register delay ──────────────────────
            else if (state == SS_DELAY) begin
                if (reg_idx >= REG_LEN || reg_rom[reg_idx] == 16'hFFFF) begin
                    // Done or end marker
                    reg_idx <= reg_idx + 1;
                    if (reg_idx >= REG_LEN - 1)
                        state <= SS_DONE;
                    else begin
                        delay_cnt <= 0;
                        // Skip delay entry, move to next
                        reg_idx <= reg_idx + 1;
                    end
                end else begin
                    state <= SS_START;
                    clk_cnt <= 0;
                end
            end

            // ── SCCB Start condition: SDA high→low while SCL high ──
            else if (state == SS_START) begin
                sccb_clk <= 1;
                sdat_out <= 0;
                sdat_oe  <= 1;
                if (clk_cnt < CLK_DIV)
                    clk_cnt <= clk_cnt + 1;
                else begin
                    clk_cnt <= 0;
                    shift   <= OV7670_ADDR;
                    bit_pos <= 7;
                    state   <= SS_ADDR;
                end
            end

            // ── Send device address (8 bits + don't-care) ─
            else if (state == SS_ADDR) begin
                if (clk_cnt < CLK_DIV) begin
                    clk_cnt  <= clk_cnt + 1;
                    sccb_clk <= 0;
                    sdat_out <= shift[bit_pos];
                end else if (clk_cnt < 2*CLK_DIV) begin
                    clk_cnt  <= clk_cnt + 1;
                    sccb_clk <= 1;
                end else begin
                    clk_cnt <= 0;
                    if (bit_pos > 0)
                        bit_pos <= bit_pos - 1;
                    else begin
                        // Don't-care (9th bit)
                        sdat_oe  <= 0;  // release
                        shift    <= reg_rom[reg_idx][15:8];  // register address
                        bit_pos  <= 7;
                        state    <= SS_REG;
                    end
                end
            end

            // ── Send register address ──────────────────────
            else if (state == SS_REG) begin
                if (clk_cnt < CLK_DIV) begin
                    clk_cnt  <= clk_cnt + 1;
                    sccb_clk <= 0;
                    sdat_oe  <= 1;
                    sdat_out <= shift[bit_pos];
                end else if (clk_cnt < 2*CLK_DIV) begin
                    clk_cnt  <= clk_cnt + 1;
                    sccb_clk <= 1;
                end else begin
                    clk_cnt <= 0;
                    if (bit_pos > 0)
                        bit_pos <= bit_pos - 1;
                    else begin
                        sdat_oe  <= 0;
                        shift    <= reg_rom[reg_idx][7:0];  // register value
                        bit_pos  <= 7;
                        state    <= SS_VAL;
                    end
                end
            end

            // ── Send register value ────────────────────────
            else if (state == SS_VAL) begin
                if (clk_cnt < CLK_DIV) begin
                    clk_cnt  <= clk_cnt + 1;
                    sccb_clk <= 0;
                    sdat_oe  <= 1;
                    sdat_out <= shift[bit_pos];
                end else if (clk_cnt < 2*CLK_DIV) begin
                    clk_cnt  <= clk_cnt + 1;
                    sccb_clk <= 1;
                end else begin
                    clk_cnt <= 0;
                    if (bit_pos > 0)
                        bit_pos <= bit_pos - 1;
                    else begin
                        sdat_oe <= 0;
                        state   <= SS_STOP;
                    end
                end
            end

            // ── SCCB Stop: SDA low→high while SCL high ────
            else if (state == SS_STOP) begin
                sccb_clk <= 1;
                sdat_oe  <= 1;
                sdat_out <= 0;
                if (clk_cnt < CLK_DIV)
                    clk_cnt <= clk_cnt + 1;
                else begin
                    sdat_out <= 1;  // stop
                    clk_cnt  <= 0;
                    reg_idx  <= reg_idx + 1;
                    delay_cnt<= 0;
                    state    <= SS_DELAY;
                end
            end

            else if (state == SS_DONE) begin
                sccb_clk <= 1;
                sdat_out <= 1;
                sdat_oe  <= 1;
                // Stay done — camera configured
            end
        end
    end
endmodule
