// ============================================================
// FPGA Frame Buffer — Single-port BRAM, 38400 bytes
// Write: camera pixel stream (fast)
// Read:  UART sender (slow drain)
// ============================================================
module frame_buffer (
    input  wire        wr_clk,
    input  wire        wr_en,
    input  wire [15:0] wr_addr,   // 0..38399
    input  wire [7:0]  wr_data,

    input  wire        rd_clk,
    input  wire        rd_en,
    input  wire [15:0] rd_addr,
    output reg  [7:0]  rd_data
);
    // 38400-byte BRAM (Vivado infers RAMB36E1 / RAMB18E1 automatically)
    (* ram_style = "block" *)
    reg [7:0] mem [0:38399];

    always @(posedge wr_clk)
        if (wr_en) mem[wr_addr] <= wr_data;

    always @(posedge rd_clk)
        if (rd_en) rd_data <= mem[rd_addr];

endmodule
