// ============================================================
// UART Passthrough — Temporary bitstream for ESP-12F flashing
// 
// Routes: USB-UART ↔ FPGA ↔ ESP-12F
// This lets you flash the ESP-12F via Arduino IDE / esptool
//
// Steps:
//   1. Program this bitstream to FPGA
//   2. Ground ESP GPIO0 (bootloader mode)
//   3. Flash ESP with Arduino IDE
//   4. Remove GPIO0 jumper, press RESET
//   5. Re-program FPGA with main smart_agri_fpga bitstream
// ============================================================
module top (
    input  wire clk,

    // USB-UART (FT2232H Channel B)
    input  wire usb_rx,    // PC → FPGA   (C4)
    output wire usb_tx,    // FPGA → PC   (D4)

    // ESP-12F WiFi UART
    output wire esp_tx,    // FPGA → ESP  (J15)
    input  wire esp_rx,    // ESP → FPGA  (G16)

    // LED: blink to show passthrough is active
    output wire [3:0] led,

    // Unused — tie off
    input  wire btn_capture,
    input  wire btn_rst,
    output wire tft_sck,
    output wire tft_sdi,
    output wire tft_dc,
    output wire tft_reset,
    output wire tft_cs
);
    // ── Transparent passthrough ─────────────────────────────
    assign esp_tx = usb_rx;   // PC → ESP
    assign usb_tx = esp_rx;   // ESP → PC

    // ── Tie off unused outputs ──────────────────────────────
    assign tft_sck   = 1'b0;
    assign tft_sdi   = 1'b0;
    assign tft_dc    = 1'b1;
    assign tft_reset = 1'b1;
    assign tft_cs    = 1'b1;

    // ── Blink LED[0] @ 1Hz to confirm passthrough active ───
    reg [26:0] blink_cnt = 0;
    reg        blink_r   = 0;

    always @(posedge clk) begin
        blink_cnt <= blink_cnt + 1;
        if (blink_cnt == 27'd50_000_000) begin
            blink_cnt <= 0;
            blink_r   <= ~blink_r;
        end
    end

    assign led[0] = blink_r;   // blinking = passthrough active
    assign led[1] = ~usb_rx;   // flickers when PC sends data
    assign led[2] = ~esp_rx;   // flickers when ESP sends data
    assign led[3] = 1'b0;

endmodule
