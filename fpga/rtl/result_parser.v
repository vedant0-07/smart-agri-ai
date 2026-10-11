// ============================================================
// Result Parser — Receives AI result from ESP-12F via UART
//
// Protocol (from ESP → FPGA):
//   0xBB          = RESULT_START marker
//   [1 byte]      = label length (1–20)
//   [N bytes]     = ASCII label text
//   [1 byte]      = confidence integer (0–100)
//   0xCC          = RESULT_END marker
//
// Outputs:
//   label[159:0]  = 20-byte packed ASCII label
//   conf_pct[7:0] = confidence 0–100
//   result_valid  = 1-cycle pulse when full result received
// ============================================================
module result_parser (
    input  wire        clk,
    input  wire        rst_n,
    // From uart_rx
    input  wire [7:0]  rx_byte,
    input  wire        rx_valid,
    // Decoded outputs
    output reg  [159:0] label,      // 20 chars packed
    output reg  [7:0]  conf_pct,
    output reg         result_valid
);
    localparam MARKER_START = 8'hBB;
    localparam MARKER_END   = 8'hCC;

    localparam PS_IDLE     = 3'd0;
    localparam PS_LEN      = 3'd1;
    localparam PS_LABEL    = 3'd2;
    localparam PS_CONF     = 3'd3;
    localparam PS_END      = 3'd4;

    reg [2:0]  pstate;
    reg [4:0]  char_cnt;
    reg [4:0]  label_len;
    reg [159:0] label_buf;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            pstate       <= PS_IDLE;
            result_valid <= 1'b0;
            label        <= 0;
            conf_pct     <= 0;
            label_buf    <= 0;
            char_cnt     <= 0;
            label_len    <= 0;
        end else begin
            result_valid <= 1'b0;

            if (rx_valid) begin
                case (pstate)
                    PS_IDLE: begin
                        if (rx_byte == MARKER_START) begin
                            label_buf <= 0;
                            char_cnt  <= 0;
                            pstate    <= PS_LEN;
                        end
                    end
                    PS_LEN: begin
                        label_len <= rx_byte[4:0];  // max 20
                        pstate    <= PS_LABEL;
                    end
                    PS_LABEL: begin
                        // Shift label bytes into buffer (MSB = first char)
                        label_buf <= {label_buf[151:0], rx_byte};
                        char_cnt  <= char_cnt + 1;
                        if (char_cnt >= label_len - 1)
                            pstate <= PS_CONF;
                    end
                    PS_CONF: begin
                        conf_pct <= rx_byte;
                        pstate   <= PS_END;
                    end
                    PS_END: begin
                        if (rx_byte == MARKER_END) begin
                            label        <= label_buf;
                            result_valid <= 1'b1;
                        end
                        pstate <= PS_IDLE;
                    end
                endcase
            end
        end
    end
endmodule
