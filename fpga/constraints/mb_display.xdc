## ============================================================
## mb_display.xdc — 3EDGE Artix-7 XC7A35T
## MicroBlaze + ILI9341 TFT + ESP32 UART
## ============================================================

## ── Clock ────────────────────────────────────────────────────
set_property -dict {PACKAGE_PIN N11 IOSTANDARD LVCMOS33} [get_ports clk_100mhz]
create_clock -period 10.000 -name sys_clk [get_ports clk_100mhz]

## ── Reset (active-low, connect to GND if not using button) ──
set_property -dict {PACKAGE_PIN L14 IOSTANDARD LVCMOS33 PULLUP true} [get_ports rst_n]

## ── LEDs ─────────────────────────────────────────────────────
set_property -dict {PACKAGE_PIN J3 IOSTANDARD LVCMOS33} [get_ports {leds[0]}]
set_property -dict {PACKAGE_PIN H3 IOSTANDARD LVCMOS33} [get_ports {leds[1]}]
set_property -dict {PACKAGE_PIN J1 IOSTANDARD LVCMOS33} [get_ports {leds[2]}]
set_property -dict {PACKAGE_PIN K1 IOSTANDARD LVCMOS33} [get_ports {leds[3]}]

## ── TFT ILI9341 SPI ──────────────────────────────────────────
set_property -dict {PACKAGE_PIN T13 IOSTANDARD LVCMOS33} [get_ports SPI_TFT_sck]
set_property -dict {PACKAGE_PIN R10 IOSTANDARD LVCMOS33} [get_ports SPI_TFT_io0_o]
set_property -dict {PACKAGE_PIN P9  IOSTANDARD LVCMOS33} [get_ports SPI_TFT_ss_o]

## ── TFT Control GPIO (DC, RST, CS optional) ──────────────────
## tft_ctrl[0] = DC   (Data/Command)
## tft_ctrl[1] = RST  (Reset)
## tft_ctrl[2] = spare
## tft_ctrl[3] = spare
set_property -dict {PACKAGE_PIN R11 IOSTANDARD LVCMOS33} [get_ports {tft_ctrl[0]}]
set_property -dict {PACKAGE_PIN N9  IOSTANDARD LVCMOS33} [get_ports {tft_ctrl[1]}]
set_property -dict {PACKAGE_PIN M9  IOSTANDARD LVCMOS33} [get_ports {tft_ctrl[2]}]
set_property -dict {PACKAGE_PIN N8  IOSTANDARD LVCMOS33} [get_ports {tft_ctrl[3]}]

## ── UART from ESP32 (ESP32 GPIO17 TX → FPGA RX) ─────────────
## UART_ESP32_rxd = FPGA receives from ESP32
set_property -dict {PACKAGE_PIN C4  IOSTANDARD LVCMOS33} [get_ports UART_ESP32_rxd]
## UART_ESP32_txd = FPGA sends to ESP32 (optional, not used)
set_property -dict {PACKAGE_PIN D4  IOSTANDARD LVCMOS33} [get_ports UART_ESP32_txd]

## ── Config ────────────────────────────────────────────────────
set_property CFGBVS        VCCO [current_design]
set_property CONFIG_VOLTAGE 3.3  [current_design]
