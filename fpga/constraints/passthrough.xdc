## ============================================================
## XDC for UART Passthrough (temporary — for ESP-12F flashing)
## Only includes the pins used by top_passthrough.v
## ============================================================

## Clock
set_property -dict { PACKAGE_PIN N11 IOSTANDARD LVCMOS33 } [get_ports { clk }];
create_clock -period 10.000 -name sys_clk [get_ports { clk }];

## USB-UART (FT2232H Channel B)
set_property -dict { PACKAGE_PIN C4 IOSTANDARD LVCMOS33 } [get_ports { usb_rx }];
set_property -dict { PACKAGE_PIN D4 IOSTANDARD LVCMOS33 } [get_ports { usb_tx }];

## WiFi ESP-12F UART
set_property -dict { PACKAGE_PIN J15 IOSTANDARD LVCMOS33 } [get_ports { esp_tx }];
set_property -dict { PACKAGE_PIN G16 IOSTANDARD LVCMOS33 } [get_ports { esp_rx }];

## LEDs (show passthrough activity)
set_property -dict { PACKAGE_PIN J3 IOSTANDARD LVCMOS33 } [get_ports { led[0] }];
set_property -dict { PACKAGE_PIN H3 IOSTANDARD LVCMOS33 } [get_ports { led[1] }];
set_property -dict { PACKAGE_PIN J1 IOSTANDARD LVCMOS33 } [get_ports { led[2] }];
set_property -dict { PACKAGE_PIN K1 IOSTANDARD LVCMOS33 } [get_ports { led[3] }];

## Buttons (unused but must be constrained to avoid errors)
set_property -dict { PACKAGE_PIN K13 IOSTANDARD LVCMOS33 PULLDOWN true } [get_ports { btn_capture }];
set_property -dict { PACKAGE_PIN L14 IOSTANDARD LVCMOS33 PULLDOWN true } [get_ports { btn_rst }];

## TFT (unused but tied off in top, must be constrained)
set_property -dict { PACKAGE_PIN T13 IOSTANDARD LVCMOS33 } [get_ports { tft_sck }];
set_property -dict { PACKAGE_PIN R10 IOSTANDARD LVCMOS33 } [get_ports { tft_sdi }];
set_property -dict { PACKAGE_PIN R11 IOSTANDARD LVCMOS33 } [get_ports { tft_dc }];
set_property -dict { PACKAGE_PIN N9  IOSTANDARD LVCMOS33 } [get_ports { tft_reset }];
set_property -dict { PACKAGE_PIN P9  IOSTANDARD LVCMOS33 } [get_ports { tft_cs }];

## Config
set_property CFGBVS         VCCO [current_design];
set_property CONFIG_VOLTAGE  3.3  [current_design];
