-- Copyright 1986-2022 Xilinx, Inc. All Rights Reserved.
-- Copyright 2022-2026 Advanced Micro Devices, Inc. All Rights Reserved.
-- -------------------------------------------------------------------------------
-- This file contains confidential and proprietary information
-- of AMD and is protected under U.S. and international copyright
-- and other intellectual property laws.
--
-- DISCLAIMER
-- This disclaimer is not a license and does not grant any
-- rights to the materials distributed herewith. Except as
-- otherwise provided in a valid license issued to you by
-- AMD, and to the maximum extent permitted by applicable
-- law: (1) THESE MATERIALS ARE MADE AVAILABLE "AS IS" AND
-- WITH ALL FAULTS, AND AMD HEREBY DISCLAIMS ALL WARRANTIES
-- AND CONDITIONS, EXPRESS, IMPLIED, OR STATUTORY, INCLUDING
-- BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, NON-
-- INFRINGEMENT, OR FITNESS FOR ANY PARTICULAR PURPOSE; and
-- (2) AMD shall not be liable (whether in contract or tort,
-- including negligence, or under any other theory of
-- liability) for any loss or damage of any kind or nature
-- related to, arising under or in connection with these
-- materials, including for any direct, or any indirect,
-- special, incidental, or consequential loss or damage
-- (including loss of data, profits, goodwill, or any type of
-- loss or damage suffered as a result of any action brought
-- by a third party) even if such damage or loss was
-- reasonably foreseeable or AMD had been advised of the
-- possibility of the same.
--
-- CRITICAL APPLICATIONS
-- AMD products are not designed or intended to be fail-
-- safe, or for use in any application requiring fail-safe
-- performance, such as life-support or safety devices or
-- systems, Class III medical devices, nuclear facilities,
-- applications related to the deployment of airbags, or any
-- other applications that could lead to death, personal
-- injury, or severe property or environmental damage
-- (individually and collectively, "Critical
-- Applications"). Customer assumes the sole risk and
-- liability of any use of AMD products in Critical
-- Applications, subject only to applicable laws and
-- regulations governing limitations on product liability.
--
-- THIS COPYRIGHT NOTICE AND DISCLAIMER MUST BE RETAINED AS
-- PART OF THIS FILE AT ALL TIMES.
--
-- DO NOT MODIFY THIS FILE.

-- MODULE VLNV: amd.com:blockdesign:mb_tft:1.0

-- The following code must appear in the VHDL architecture header.

-- COMP_TAG     ------ Begin cut for COMPONENT Declaration ------
COMPONENT mb_tft
  PORT (
    clk_100mhz : IN STD_LOGIC;
    rst_n : IN STD_LOGIC;
    UART_ESP32_rxd : IN STD_LOGIC;
    UART_ESP32_txd : OUT STD_LOGIC;
    SPI_TFT_io0_i : IN STD_LOGIC;
    SPI_TFT_io0_o : OUT STD_LOGIC;
    SPI_TFT_io0_t : OUT STD_LOGIC;
    SPI_TFT_io1_i : IN STD_LOGIC;
    SPI_TFT_io1_o : OUT STD_LOGIC;
    SPI_TFT_io1_t : OUT STD_LOGIC;
    SPI_TFT_ss_i : IN STD_LOGIC_VECTOR(0 DOWNTO 0);
    SPI_TFT_ss_o : OUT STD_LOGIC_VECTOR(0 DOWNTO 0);
    SPI_TFT_ss_t : OUT STD_LOGIC;
    tft_ctrl : OUT STD_LOGIC_VECTOR(3 DOWNTO 0);
    leds : OUT STD_LOGIC_VECTOR(3 DOWNTO 0)
  );
END COMPONENT;
-- COMP_TAG_END ------  End cut for COMPONENT Declaration  ------

-- The following code must appear in the VHDL architecture
-- body. Substitute your own instance name and net names.

-- INST_TAG     ------ Begin cut for INSTANTIATION Template ------
your_instance_name : mb_tft
  PORT MAP (
    clk_100mhz => clk_100mhz,
    rst_n => rst_n,
    UART_ESP32_rxd => UART_ESP32_rxd,
    UART_ESP32_txd => UART_ESP32_txd,
    SPI_TFT_io0_i => SPI_TFT_io0_i,
    SPI_TFT_io0_o => SPI_TFT_io0_o,
    SPI_TFT_io0_t => SPI_TFT_io0_t,
    SPI_TFT_io1_i => SPI_TFT_io1_i,
    SPI_TFT_io1_o => SPI_TFT_io1_o,
    SPI_TFT_io1_t => SPI_TFT_io1_t,
    SPI_TFT_ss_i => SPI_TFT_ss_i,
    SPI_TFT_ss_o => SPI_TFT_ss_o,
    SPI_TFT_ss_t => SPI_TFT_ss_t,
    tft_ctrl => tft_ctrl,
    leds => leds
  );
-- INST_TAG_END ------  End cut for INSTANTIATION Template  ------

-- You must compile the wrapper file mb_tft.vhd when simulating
-- the module, mb_tft. When compiling the wrapper file, be sure to
-- reference the VHDL simulation library.
