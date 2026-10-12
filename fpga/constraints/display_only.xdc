## ============================================================
## 3EDGE Artix-7 XC7A35T — Display-Only XDC
## FPGA receives AI result from ESP32 via UART → shows on TFT
## ============================================================

## ── Clock (100 MHz) ───────────────────────────────────────
set_property -dict { PACKAGE_PIN N11 IOSTANDARD LVCMOS33 } [get_ports { clk }];
create_clock -period 10.000 -name sys_clk [get_ports { clk }];

## ── Reset button ──────────────────────────────────────────
set_property -dict { PACKAGE_PIN L14 IOSTANDARD LVCMOS33 PULLDOWN true } [get_ports { btn_rst }];

## ── LEDs ──────────────────────────────────────────────────
set_property -dict { PACKAGE_PIN J3 IOSTANDARD LVCMOS33 } [get_ports { led[0] }];
set_property -dict { PACKAGE_PIN H3 IOSTANDARD LVCMOS33 } [get_ports { led[1] }];
set_property -dict { PACKAGE_PIN J1 IOSTANDARD LVCMOS33 } [get_ports { led[2] }];
set_property -dict { PACKAGE_PIN K1 IOSTANDARD LVCMOS33 } [get_ports { led[3] }];

## ── TFT ILI9341 ───────────────────────────────────────────
set_property -dict { PACKAGE_PIN T13 IOSTANDARD LVCMOS33 } [get_ports { tft_sck }];
set_property -dict { PACKAGE_PIN R10 IOSTANDARD LVCMOS33 } [get_ports { tft_sdi }];
set_property -dict { PACKAGE_PIN R11 IOSTANDARD LVCMOS33 } [get_ports { tft_dc }];
set_property -dict { PACKAGE_PIN N9  IOSTANDARD LVCMOS33 } [get_ports { tft_reset }];
set_property -dict { PACKAGE_PIN P9  IOSTANDARD LVCMOS33 } [get_ports { tft_cs }];

## ── UART from ESP32 ───────────────────────────────────────
## ESP32 GPIO17 (TX) → FPGA C4 (esp_rx)
## Connect wire: ESP32 pin 17 → FPGA header pin C4
set_property -dict { PACKAGE_PIN C4 IOSTANDARD LVCMOS33 } [get_ports { esp_rx }];

## ── Config ────────────────────────────────────────────────
set_property CFGBVS        VCCO [current_design];
set_property CONFIG_VOLTAGE 3.3  [current_design];
