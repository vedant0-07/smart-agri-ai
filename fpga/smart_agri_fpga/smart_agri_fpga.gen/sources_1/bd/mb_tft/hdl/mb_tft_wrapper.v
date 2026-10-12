//Copyright 1986-2022 Xilinx, Inc. All Rights Reserved.
//Copyright 2022-2026 Advanced Micro Devices, Inc. All Rights Reserved.
//--------------------------------------------------------------------------------
//Tool Version: Vivado v.2026.1 (win64) Build 6511674 Tue Jun 16 11:02:23 MDT 2026
//Date        : Mon Oct 12 08:05:56 2026
//Host        : DESKTOP-VSVSHKO running 64-bit major release  (build 9200)
//Command     : generate_target mb_tft_wrapper.bd
//Design      : mb_tft_wrapper
//Purpose     : IP block netlist
//--------------------------------------------------------------------------------
`timescale 1 ps / 1 ps

module mb_tft_wrapper
   (SPI_TFT_io0_io,
    SPI_TFT_io1_io,
    SPI_TFT_ss_io,
    UART_ESP32_rxd,
    UART_ESP32_txd,
    clk_100mhz,
    leds,
    rst_n,
    tft_ctrl);
  inout SPI_TFT_io0_io;
  inout SPI_TFT_io1_io;
  inout [0:0]SPI_TFT_ss_io;
  input UART_ESP32_rxd;
  output UART_ESP32_txd;
  input clk_100mhz;
  output [3:0]leds;
  input rst_n;
  output [3:0]tft_ctrl;

  wire SPI_TFT_io0_i;
  wire SPI_TFT_io0_io;
  wire SPI_TFT_io0_o;
  wire SPI_TFT_io0_t;
  wire SPI_TFT_io1_i;
  wire SPI_TFT_io1_io;
  wire SPI_TFT_io1_o;
  wire SPI_TFT_io1_t;
  wire [0:0]SPI_TFT_ss_i_0;
  wire [0:0]SPI_TFT_ss_io_0;
  wire [0:0]SPI_TFT_ss_o_0;
  wire SPI_TFT_ss_t;
  wire UART_ESP32_rxd;
  wire UART_ESP32_txd;
  wire clk_100mhz;
  wire [3:0]leds;
  wire rst_n;
  wire [3:0]tft_ctrl;

  IOBUF SPI_TFT_io0_iobuf
       (.I(SPI_TFT_io0_o),
        .IO(SPI_TFT_io0_io),
        .O(SPI_TFT_io0_i),
        .T(SPI_TFT_io0_t));
  IOBUF SPI_TFT_io1_iobuf
       (.I(SPI_TFT_io1_o),
        .IO(SPI_TFT_io1_io),
        .O(SPI_TFT_io1_i),
        .T(SPI_TFT_io1_t));
  IOBUF SPI_TFT_ss_iobuf_0
       (.I(SPI_TFT_ss_o_0),
        .IO(SPI_TFT_ss_io[0]),
        .O(SPI_TFT_ss_i_0),
        .T(SPI_TFT_ss_t));
  mb_tft mb_tft_i
       (.SPI_TFT_io0_i(SPI_TFT_io0_i),
        .SPI_TFT_io0_o(SPI_TFT_io0_o),
        .SPI_TFT_io0_t(SPI_TFT_io0_t),
        .SPI_TFT_io1_i(SPI_TFT_io1_i),
        .SPI_TFT_io1_o(SPI_TFT_io1_o),
        .SPI_TFT_io1_t(SPI_TFT_io1_t),
        .SPI_TFT_ss_i(SPI_TFT_ss_i_0),
        .SPI_TFT_ss_o(SPI_TFT_ss_o_0),
        .SPI_TFT_ss_t(SPI_TFT_ss_t),
        .UART_ESP32_rxd(UART_ESP32_rxd),
        .UART_ESP32_txd(UART_ESP32_txd),
        .clk_100mhz(clk_100mhz),
        .leds(leds),
        .rst_n(rst_n),
        .tft_ctrl(tft_ctrl));
endmodule
