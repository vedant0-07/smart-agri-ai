// ============================================================
// TOP MODULE — DISPLAY ONLY
// 3EDGE Artix-7 XC7A35T
//
// Function: Receive AI result from ESP32 via UART
//           Display on ILI9341 TFT screen
//
// Nothing else — no camera, no capture, no buttons
//
// Protocol (from ESP32):
//   0xBB [len] [label ASCII] [conf_percent] 0xCC
// ============================================================
module top (
    input  wire        clk,        // 100 MHz (N11)
    input  wire        btn_rst,    // Reset button L14

    // TFT ILI9341
    output wire        tft_sck,
    output wire        tft_sdi,
    output wire        tft_dc,
    output wire        tft_reset,
    output wire        tft_cs,

    // UART from ESP32 (USB-UART pins on board)
    input  wire        esp_rx,     // C4  ← ESP32 UART TX

    // Status LEDs
    output reg  [3:0]  led
);

    wire rst_n = ~btn_rst;

    // ── UART RX ─────────────────────────────────────────────
    wire [7:0] rx_byte;
    wire       rx_valid;

    uart_rx #(
        .CLK_FREQ(100_000_000),
        .BAUD_RATE(115_200)
    ) u_rx (
        .clk       (clk),
        .rst_n     (rst_n),
        .rx        (esp_rx),
        .data_out  (rx_byte),
        .data_valid(rx_valid)
    );

    // ── Result parser ────────────────────────────────────────
    // Parses: 0xBB [len] [label bytes...] [conf%] 0xCC
    wire [159:0] label;      // 20 ASCII bytes packed
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

    // ── TFT ILI9341 Display ──────────────────────────────────
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

    // ── LED status ───────────────────────────────────────────
    reg result_latch;
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            led          <= 4'b0001;  // LED0 = idle
            result_latch <= 0;
        end else begin
            if (result_valid) begin
                result_latch <= 1;
                led <= 4'b1000;       // LED3 = result received
            end
            if (rx_valid && !result_latch)
                led <= 4'b0010;       // LED1 = receiving data
        end
    end

endmodule
