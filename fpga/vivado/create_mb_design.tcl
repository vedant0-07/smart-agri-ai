# ============================================================
# create_mb_design.tcl  —  Smart Agri TFT MicroBlaze Design
#
# Run in Vivado Tcl Console AFTER creating/opening a project:
#   source {E:/fpga website/smart-agri-app/fpga/vivado/create_mb_design.tcl}
#
# Creates:
#   MicroBlaze + AXI UART Lite (ESP32) + AXI Quad SPI (TFT)
#   + AXI GPIO (TFT DC/RST + LEDs) + 64KB BRAM
# ============================================================

# ─── 0. Clean up any existing design ─────────────────────────
# close_bd_design closes it, remove_files + file delete removes the .bd file
catch { close_bd_design [get_bd_designs mb_tft] }

set existing_bd [get_files -quiet -of_objects \
    [get_filesets sources_1] {*mb_tft.bd}]
if { $existing_bd ne "" } {
    remove_files -fileset sources_1 $existing_bd
    catch { file delete -force $existing_bd }
    puts "INFO: Deleted existing mb_tft.bd"
}

create_bd_design "mb_tft"
update_compile_order -fileset sources_1

# ─── 1. Clock Wizard ──────────────────────────────────────────
create_bd_cell -type ip -vlnv xilinx.com:ip:clk_wiz:6.0 clk_wiz_0
set_property -dict [list \
    CONFIG.PRIMITIVE                  {MMCM} \
    CONFIG.CLKOUT1_REQUESTED_OUT_FREQ {100.000} \
    CONFIG.USE_LOCKED                 {true} \
    CONFIG.USE_RESET                  {false} \
] [get_bd_cells clk_wiz_0]

# ─── 2. MicroBlaze ────────────────────────────────────────────
create_bd_cell -type ip -vlnv xilinx.com:ip:microblaze:11.0 microblaze_0
set_property -dict [list \
    CONFIG.C_DEBUG_ENABLED {1} \
    CONFIG.C_D_AXI         {1} \
    CONFIG.C_D_LMB         {1} \
    CONFIG.C_I_LMB         {1} \
] [get_bd_cells microblaze_0]

# ── MicroBlaze automation (adds BRAM, LMB, MDM, proc_sys_reset)
apply_bd_automation \
    -rule  xilinx.com:bd_rule:microblaze \
    -config {
        local_mem    "64KB"
        ecc          "None"
        cache        "None"
        debug_module "Debug Only"
        axi_periph   "Enabled"
        axi_intc     "0"
        clk          "/clk_wiz_0/clk_out1"
    } [get_bd_cells microblaze_0]

# ─── 3. AXI UART Lite (115200 baud, ESP32) ────────────────────
create_bd_cell -type ip -vlnv xilinx.com:ip:axi_uartlite:2.0 axi_uart_esp32
set_property -dict [list \
    CONFIG.C_BAUDRATE  {115200} \
    CONFIG.C_DATA_BITS {8} \
    CONFIG.C_USE_PARITY {0} \
] [get_bd_cells axi_uart_esp32]

apply_bd_automation \
    -rule xilinx.com:bd_rule:axi4 \
    -config {
        Clk_master "/clk_wiz_0/clk_out1"
        Clk_slave  "/clk_wiz_0/clk_out1"
        Clk_xbar   "/clk_wiz_0/clk_out1"
        Master      "/microblaze_0 (Periph)"
        Slave       "/axi_uart_esp32/S_AXI"
        intc_ip     "Auto"
        master_apm  "0"
    } [get_bd_intf_pins axi_uart_esp32/S_AXI]

# ─── 4. AXI Quad SPI (ILI9341 TFT) ───────────────────────────
create_bd_cell -type ip -vlnv xilinx.com:ip:axi_quad_spi:3.2 axi_spi_tft
set_property -dict [list \
    CONFIG.C_SCK_RATIO    {4} \
    CONFIG.C_NUM_SS_BITS  {1} \
    CONFIG.C_FIFO_DEPTH   {256} \
    CONFIG.C_XIP_MODE     {0} \
    CONFIG.C_TYPE_OF_AXI4_INTERFACE {0} \
] [get_bd_cells axi_spi_tft]

apply_bd_automation \
    -rule xilinx.com:bd_rule:axi4 \
    -config {
        Clk_master "/clk_wiz_0/clk_out1"
        Clk_slave  "/clk_wiz_0/clk_out1"
        Clk_xbar   "/clk_wiz_0/clk_out1"
        Master      "/microblaze_0 (Periph)"
        Slave       "/axi_spi_tft/AXI_LITE"
        intc_ip     "Auto"
        master_apm  "0"
    } [get_bd_intf_pins axi_spi_tft/AXI_LITE]

# ─── 5. AXI GPIO (TFT DC/RST + LEDs) ─────────────────────────
create_bd_cell -type ip -vlnv xilinx.com:ip:axi_gpio:2.0 axi_gpio_tft
set_property -dict [list \
    CONFIG.C_GPIO_WIDTH    {4} \
    CONFIG.C_GPIO2_WIDTH   {4} \
    CONFIG.C_IS_DUAL       {1} \
    CONFIG.C_ALL_OUTPUTS   {1} \
    CONFIG.C_ALL_OUTPUTS_2 {1} \
] [get_bd_cells axi_gpio_tft]

apply_bd_automation \
    -rule xilinx.com:bd_rule:axi4 \
    -config {
        Clk_master "/clk_wiz_0/clk_out1"
        Clk_slave  "/clk_wiz_0/clk_out1"
        Clk_xbar   "/clk_wiz_0/clk_out1"
        Master      "/microblaze_0 (Periph)"
        Slave       "/axi_gpio_tft/S_AXI"
        intc_ip     "Auto"
        master_apm  "0"
    } [get_bd_intf_pins axi_gpio_tft/S_AXI]

# ─── 6. External Ports ────────────────────────────────────────

# Clock (100 MHz external input)
create_bd_port -dir I -type clk -freq_hz 100000000 clk_100mhz
connect_bd_net [get_bd_pins clk_wiz_0/clk_in1] \
               [get_bd_ports clk_100mhz]

# Reset: find proc_sys_reset auto-created by apply_bd_automation
# NOTE: apply_bd_automation already connects clk_wiz_0/locked automatically
# We only need to add the external reset port
set rst_cell [lindex [get_bd_cells -filter \
    {VLNV =~ xilinx.com:ip:proc_sys_reset:*}] 0]
puts "INFO: Found proc_sys_reset: $rst_cell"

# External active-low reset button → proc_sys_reset
create_bd_port -dir I -type rst rst_n
set_property CONFIG.POLARITY {ACTIVE_LOW} [get_bd_ports rst_n]
connect_bd_net [get_bd_pins $rst_cell/ext_reset_in] \
               [get_bd_ports rst_n]

# UART interface (ESP32 TX → FPGA RX)
# axi_uartlite/UART is Master → external port must also be Master
create_bd_intf_port -mode Master \
    -vlnv xilinx.com:interface:uart_rtl:1.0 UART_ESP32
connect_bd_intf_net \
    [get_bd_intf_pins axi_uart_esp32/UART] \
    [get_bd_intf_ports UART_ESP32]

# SPI TFT interface (SCK + MOSI + SS)
create_bd_intf_port -mode Master \
    -vlnv xilinx.com:interface:spi_rtl:1.0 SPI_TFT
connect_bd_intf_net \
    [get_bd_intf_pins axi_spi_tft/SPI_0] \
    [get_bd_intf_ports SPI_TFT]

# GPIO channel 1: TFT_DC[0], TFT_RST[1], TFT_CS[2], spare[3]
create_bd_port -dir O -from 3 -to 0 tft_ctrl
connect_bd_net \
    [get_bd_pins axi_gpio_tft/gpio_io_o] \
    [get_bd_ports tft_ctrl]

# GPIO channel 2: LEDs[3:0]
create_bd_port -dir O -from 3 -to 0 leds
connect_bd_net \
    [get_bd_pins axi_gpio_tft/gpio2_io_o] \
    [get_bd_ports leds]

# ─── 7. Validate and save ─────────────────────────────────────
validate_bd_design
save_bd_design

# ─── 8. Generate HDL wrapper ──────────────────────────────────
set wrapper [make_wrapper \
    -files [get_files mb_tft.bd] -top]
add_files -norecurse $wrapper
set_property top mb_tft_wrapper [current_fileset]
update_compile_order -fileset sources_1

puts ""
puts "╔══════════════════════════════════════╗"
puts "║  Block design created successfully!  ║"
puts "╠══════════════════════════════════════╣"
puts "║  Next:                               ║"
puts "║  1. Add mb_display.xdc               ║"
puts "║  2. Generate Bitstream               ║"
puts "║  3. Export Hardware (.xsa)           ║"
puts "║  4. Open Vitis → New App Project     ║"
puts "╚══════════════════════════════════════╝"
