// ============================================================
// SPI Master — Mode 0 (CPOL=0, CPHA=0)
// For ILI9341 TFT on 3EDGE Artix-7 board
// sclk = tft_sck  (T13)
// mosi = tft_sdi  (R10)
// dc   = tft_dc   (R11)  [managed externally by driver]
// ============================================================
module spi_master #(
    parameter CLK_DIV = 4   // sclk = clk / (2 * CLK_DIV)
                            // @100MHz → sclk = 12.5MHz
)(
    input  wire       clk,
    input  wire       rst_n,
    // user interface
    input  wire [7:0] tx_byte,
    input  wire       tx_valid,  // pulse to start transmission
    output reg        tx_done,
    output reg        busy,
    // SPI pins
    output reg        sclk,
    output reg        mosi
);
    reg [7:0]  shift_reg;
    reg [3:0]  clk_cnt;
    reg [3:0]  bit_cnt;   // counts 0..15 (8 half-cycles per bit)
    reg        active;
    reg        clk_phase; // 0=low half, 1=high half

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            sclk      <= 1'b0;
            mosi      <= 1'b1;
            tx_done   <= 1'b0;
            busy      <= 1'b0;
            active    <= 1'b0;
            clk_cnt   <= 0;
            bit_cnt   <= 0;
            clk_phase <= 0;
        end else begin
            tx_done <= 1'b0;

            if (!active) begin
                busy <= 1'b0;
                if (tx_valid) begin
                    shift_reg <= tx_byte;
                    bit_cnt   <= 0;
                    clk_cnt   <= 0;
                    clk_phase <= 0;
                    active    <= 1'b1;
                    busy      <= 1'b1;
                    mosi      <= tx_byte[7];  // MSB first
                end
            end else begin
                if (clk_cnt < CLK_DIV - 1) begin
                    clk_cnt <= clk_cnt + 1;
                end else begin
                    clk_cnt <= 0;
                    if (!clk_phase) begin
                        // Rising edge
                        sclk      <= 1'b1;
                        clk_phase <= 1;
                    end else begin
                        // Falling edge — shift out next bit
                        sclk <= 1'b0;
                        if (bit_cnt < 7) begin
                            bit_cnt   <= bit_cnt + 1;
                            shift_reg <= {shift_reg[6:0], 1'b0};
                            mosi      <= shift_reg[6];
                            clk_phase <= 0;
                        end else begin
                            // Done
                            active  <= 1'b0;
                            busy    <= 1'b0;
                            tx_done <= 1'b1;
                        end
                    end
                end
            end
        end
    end
endmodule
