// ============================================================
// UART Transmitter — 115200 baud @ 100MHz system clock
// For 3EDGE Artix-7 XC7A35T → ESP-12F communication
// ============================================================
module uart_tx #(
    parameter CLK_FREQ  = 100_000_000,
    parameter BAUD_RATE = 115_200
)(
    input  wire       clk,
    input  wire       rst_n,
    input  wire [7:0] data_in,
    input  wire       data_valid,
    output reg        tx,
    output reg        busy
);
    localparam CLKS_PER_BIT = CLK_FREQ / BAUD_RATE;  // 868

    localparam IDLE  = 2'd0;
    localparam START = 2'd1;
    localparam DATA  = 2'd2;
    localparam STOP  = 2'd3;

    reg [1:0]  state;
    reg [15:0] clk_cnt;
    reg [2:0]  bit_idx;
    reg [7:0]  tx_data;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state   <= IDLE;
            tx      <= 1'b1;
            busy    <= 1'b0;
            clk_cnt <= 0;
            bit_idx <= 0;
        end else begin
            case (state)
                IDLE: begin
                    tx   <= 1'b1;
                    busy <= 1'b0;
                    if (data_valid) begin
                        tx_data <= data_in;
                        state   <= START;
                        busy    <= 1'b1;
                        clk_cnt <= 0;
                    end
                end
                START: begin
                    tx <= 1'b0;  // Start bit
                    if (clk_cnt < CLKS_PER_BIT - 1)
                        clk_cnt <= clk_cnt + 1;
                    else begin
                        clk_cnt <= 0;
                        bit_idx <= 0;
                        state   <= DATA;
                    end
                end
                DATA: begin
                    tx <= tx_data[bit_idx];
                    if (clk_cnt < CLKS_PER_BIT - 1)
                        clk_cnt <= clk_cnt + 1;
                    else begin
                        clk_cnt <= 0;
                        if (bit_idx < 7)
                            bit_idx <= bit_idx + 1;
                        else
                            state <= STOP;
                    end
                end
                STOP: begin
                    tx <= 1'b1;  // Stop bit
                    if (clk_cnt < CLKS_PER_BIT - 1)
                        clk_cnt <= clk_cnt + 1;
                    else begin
                        clk_cnt <= 0;
                        state   <= IDLE;
                    end
                end
            endcase
        end
    end
endmodule
