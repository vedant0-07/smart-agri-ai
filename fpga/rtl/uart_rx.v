// ============================================================
// UART Receiver — 115200 baud @ 100MHz system clock
// Receives AI results from ESP-12F back to FPGA
// Protocol: 0xBB [len] [label...] [conf_hi] [conf_lo] 0xCC
// ============================================================
module uart_rx #(
    parameter CLK_FREQ  = 100_000_000,
    parameter BAUD_RATE = 115_200
)(
    input  wire       clk,
    input  wire       rst_n,
    input  wire       rx,
    output reg  [7:0] data_out,
    output reg        data_valid
);
    localparam CLKS_PER_BIT  = CLK_FREQ / BAUD_RATE;   // 868
    localparam HALF_BIT      = CLKS_PER_BIT / 2;       // 434

    localparam IDLE  = 2'd0;
    localparam START = 2'd1;
    localparam DATA  = 2'd2;
    localparam STOP  = 2'd3;

    reg [1:0]  state;
    reg [15:0] clk_cnt;
    reg [2:0]  bit_idx;
    reg [7:0]  rx_shift;
    reg        rx_sync0, rx_sync1;  // double-flop synchroniser

    always @(posedge clk) begin
        rx_sync0 <= rx;
        rx_sync1 <= rx_sync0;
    end

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state      <= IDLE;
            data_valid <= 1'b0;
            clk_cnt    <= 0;
            bit_idx    <= 0;
        end else begin
            data_valid <= 1'b0;
            case (state)
                IDLE: begin
                    if (!rx_sync1) begin  // falling edge = start bit
                        clk_cnt <= 0;
                        state   <= START;
                    end
                end
                START: begin
                    if (clk_cnt == HALF_BIT) begin  // sample mid-start
                        if (!rx_sync1) begin
                            clk_cnt <= 0;
                            bit_idx <= 0;
                            state   <= DATA;
                        end else
                            state <= IDLE;  // false start
                    end else
                        clk_cnt <= clk_cnt + 1;
                end
                DATA: begin
                    if (clk_cnt < CLKS_PER_BIT - 1)
                        clk_cnt <= clk_cnt + 1;
                    else begin
                        clk_cnt           <= 0;
                        rx_shift[bit_idx] <= rx_sync1;
                        if (bit_idx < 7)
                            bit_idx <= bit_idx + 1;
                        else
                            state <= STOP;
                    end
                end
                STOP: begin
                    if (clk_cnt < CLKS_PER_BIT - 1)
                        clk_cnt <= clk_cnt + 1;
                    else begin
                        data_out   <= rx_shift;
                        data_valid <= 1'b1;
                        clk_cnt    <= 0;
                        state      <= IDLE;
                    end
                end
            endcase
        end
    end
endmodule
