## ============================================================
## 3EDGE Artix-7 XC7A35T — CORRECTED XDC Pin Constraints
## Based on official EDGE Artix 7 FPGA Kit XDC Pin Details
## Source: https://allaboutfpga.com/edge-artix-7-fpga-kit-xdc-pin-details/
## ============================================================

## ── Clock (100 MHz) ───────────────────────────────────────
set_property -dict { PACKAGE_PIN N11 IOSTANDARD LVCMOS33 } [get_ports { clk }];
create_clock -period 10.000 -name sys_clk [get_ports { clk }];

## ── Push Buttons (PULLDOWN = active HIGH) ─────────────────
## pb[0] = top button    → btn_capture (trigger inference)
## pb[1] = bottom button → btn_rst     (reset)
set_property -dict { PACKAGE_PIN K13 IOSTANDARD LVCMOS33 PULLDOWN true } [get_ports { btn_capture }];
set_property -dict { PACKAGE_PIN L14 IOSTANDARD LVCMOS33 PULLDOWN true } [get_ports { btn_rst }];

## ── LEDs ──────────────────────────────────────────────────
set_property -dict { PACKAGE_PIN J3 IOSTANDARD LVCMOS33 } [get_ports { led[0] }];
set_property -dict { PACKAGE_PIN H3 IOSTANDARD LVCMOS33 } [get_ports { led[1] }];
set_property -dict { PACKAGE_PIN J1 IOSTANDARD LVCMOS33 } [get_ports { led[2] }];
set_property -dict { PACKAGE_PIN K1 IOSTANDARD LVCMOS33 } [get_ports { led[3] }];

## ── SPI TFT Display (ILI9341 2.4") ───────────────────────
## All confirmed from official XDC
set_property -dict { PACKAGE_PIN T13 IOSTANDARD LVCMOS33 } [get_ports { tft_sck }];
set_property -dict { PACKAGE_PIN R10 IOSTANDARD LVCMOS33 } [get_ports { tft_sdi }];
set_property -dict { PACKAGE_PIN R11 IOSTANDARD LVCMOS33 } [get_ports { tft_dc }];
set_property -dict { PACKAGE_PIN N9  IOSTANDARD LVCMOS33 } [get_ports { tft_reset }];
set_property -dict { PACKAGE_PIN P9  IOSTANDARD LVCMOS33 } [get_ports { tft_cs }];


## ── USB-UART (FT2232H Channel B) — Python bridge on COM4 ──
## PC Python script receives CAPTURE, calls FastAPI, sends result back
## FPGA TX → PC (D4)    FPGA RX ← PC (C4)
set_property -dict { PACKAGE_PIN D4 IOSTANDARD LVCMOS33 } [get_ports { esp_tx }];
set_property -dict { PACKAGE_PIN C4 IOSTANDARD LVCMOS33 } [get_ports { esp_rx }];


## ── Config / Misc ─────────────────────────────────────────
set_property CFGBVS        VCCO        [current_design];
set_property CONFIG_VOLTAGE 3.3        [current_design];

## OV7670 Camera (5110v0 module)
set_property -dict {PACKAGE_PIN M16 IOSTANDARD LVCMOS33} [get_ports {sccb_clk}]
set_property -dict {PACKAGE_PIN N16 IOSTANDARD LVCMOS33} [get_ports {sccb_dat}]
set_property -dict {PACKAGE_PIN P15 IOSTANDARD LVCMOS33} [get_ports {cam_vsync}]
set_property -dict {PACKAGE_PIN P16 IOSTANDARD LVCMOS33} [get_ports {cam_href}]
set_property -dict {PACKAGE_PIN R15 IOSTANDARD LVCMOS33} [get_ports {cam_pclk}]
set_property -dict {PACKAGE_PIN R16 IOSTANDARD LVCMOS33} [get_ports {cam_xclk}]
set_property -dict {PACKAGE_PIN T14 IOSTANDARD LVCMOS33} [get_ports {cam_data[7]}]
set_property -dict {PACKAGE_PIN T15 IOSTANDARD LVCMOS33} [get_ports {cam_data[6]}]
set_property -dict {PACKAGE_PIN N13 IOSTANDARD LVCMOS33} [get_ports {cam_data[5]}]
set_property -dict {PACKAGE_PIN P13 IOSTANDARD LVCMOS33} [get_ports {cam_data[4]}]
set_property -dict {PACKAGE_PIN N14 IOSTANDARD LVCMOS33} [get_ports {cam_data[3]}]
set_property -dict {PACKAGE_PIN P14 IOSTANDARD LVCMOS33} [get_ports {cam_data[2]}]
set_property -dict {PACKAGE_PIN P10 IOSTANDARD LVCMOS33} [get_ports {cam_data[1]}]
set_property -dict {PACKAGE_PIN P11 IOSTANDARD LVCMOS33} [get_ports {cam_data[0]}]
set_property -dict {PACKAGE_PIN R12 IOSTANDARD LVCMOS33} [get_ports {cam_reset}]
set_property -dict {PACKAGE_PIN T12 IOSTANDARD LVCMOS33} [get_ports {cam_pwdn}]

