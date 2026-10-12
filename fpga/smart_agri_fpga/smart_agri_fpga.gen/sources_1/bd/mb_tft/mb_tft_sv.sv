// Copyright 1986-2022 Xilinx, Inc. All Rights Reserved.
// Copyright 2022-2026 Advanced Micro Devices, Inc. All Rights Reserved.
// -------------------------------------------------------------------------------
// This file contains confidential and proprietary information
// of AMD and is protected under U.S. and international copyright
// and other intellectual property laws.
//
// DISCLAIMER
// This disclaimer is not a license and does not grant any
// rights to the materials distributed herewith. Except as
// otherwise provided in a valid license issued to you by
// AMD, and to the maximum extent permitted by applicable
// law: (1) THESE MATERIALS ARE MADE AVAILABLE "AS IS" AND
// WITH ALL FAULTS, AND AMD HEREBY DISCLAIMS ALL WARRANTIES
// AND CONDITIONS, EXPRESS, IMPLIED, OR STATUTORY, INCLUDING
// BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, NON-
// INFRINGEMENT, OR FITNESS FOR ANY PARTICULAR PURPOSE; and
// (2) AMD shall not be liable (whether in contract or tort,
// including negligence, or under any other theory of
// liability) for any loss or damage of any kind or nature
// related to, arising under or in connection with these
// materials, including for any direct, or any indirect,
// special, incidental, or consequential loss or damage
// (including loss of data, profits, goodwill, or any type of
// loss or damage suffered as a result of any action brought
// by a third party) even if such damage or loss was
// reasonably foreseeable or AMD had been advised of the
// possibility of the same.
//
// CRITICAL APPLICATIONS
// AMD products are not designed or intended to be fail-
// safe, or for use in any application requiring fail-safe
// performance, such as life-support or safety devices or
// systems, Class III medical devices, nuclear facilities,
// applications related to the deployment of airbags, or any
// other applications that could lead to death, personal
// injury, or severe property or environmental damage
// (individually and collectively, "Critical
// Applications"). Customer assumes the sole risk and
// liability of any use of AMD products in Critical
// Applications, subject only to applicable laws and
// regulations governing limitations on product liability.
//
// THIS COPYRIGHT NOTICE AND DISCLAIMER MUST BE RETAINED AS
// PART OF THIS FILE AT ALL TIMES.
//
// DO NOT MODIFY THIS FILE.

// MODULE VLNV: amd.com:blockdesign:mb_tft:1.0

`timescale 1ps / 1ps

`include "vivado_interfaces.svh"

module mb_tft_sv (
  (* X_INTERFACE_IGNORE = "true" *)
  input wire clk_100mhz,
  (* X_INTERFACE_IGNORE = "true" *)
  input wire rst_n,
  (* X_INTERFACE_IGNORE = "true" *)
  input wire UART_ESP32_rxd,
  (* X_INTERFACE_IGNORE = "true" *)
  output wire UART_ESP32_txd,
  (* X_INTERFACE_IGNORE = "true" *)
  input wire SPI_TFT_io0_i,
  (* X_INTERFACE_IGNORE = "true" *)
  output wire SPI_TFT_io0_o,
  (* X_INTERFACE_IGNORE = "true" *)
  output wire SPI_TFT_io0_t,
  (* X_INTERFACE_IGNORE = "true" *)
  input wire SPI_TFT_io1_i,
  (* X_INTERFACE_IGNORE = "true" *)
  output wire SPI_TFT_io1_o,
  (* X_INTERFACE_IGNORE = "true" *)
  output wire SPI_TFT_io1_t,
  (* X_INTERFACE_IGNORE = "true" *)
  input wire [0:0] SPI_TFT_ss_i,
  (* X_INTERFACE_IGNORE = "true" *)
  output wire [0:0] SPI_TFT_ss_o,
  (* X_INTERFACE_IGNORE = "true" *)
  output wire SPI_TFT_ss_t,
  (* X_INTERFACE_IGNORE = "true" *)
  output wire [3:0] tft_ctrl,
  (* X_INTERFACE_IGNORE = "true" *)
  output wire [3:0] leds
);

  mb_tft inst (
    .clk_100mhz(clk_100mhz),
    .rst_n(rst_n),
    .UART_ESP32_rxd(UART_ESP32_rxd),
    .UART_ESP32_txd(UART_ESP32_txd),
    .SPI_TFT_io0_i(SPI_TFT_io0_i),
    .SPI_TFT_io0_o(SPI_TFT_io0_o),
    .SPI_TFT_io0_t(SPI_TFT_io0_t),
    .SPI_TFT_io1_i(SPI_TFT_io1_i),
    .SPI_TFT_io1_o(SPI_TFT_io1_o),
    .SPI_TFT_io1_t(SPI_TFT_io1_t),
    .SPI_TFT_ss_i(SPI_TFT_ss_i),
    .SPI_TFT_ss_o(SPI_TFT_ss_o),
    .SPI_TFT_ss_t(SPI_TFT_ss_t),
    .tft_ctrl(tft_ctrl),
    .leds(leds)
  );

endmodule
