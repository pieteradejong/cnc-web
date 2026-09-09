/**
 * dosbox.conf generation.
 *
 * js-dos accepts a complete config string instead of a packaged bundle, so the
 * whole "install" is assembled at runtime from the user's own files: the config
 * mounts the injected filesystem as C:, changes into the game directory and
 * runs the executable. DOSBox fills in defaults for anything not listed here.
 */

export interface ConfOptions {
  /** Directory the game files were injected into, e.g. "CNC". */
  readonly dir: string;
  readonly executable: string;
  readonly cycles: number;
}

export function buildDosboxConf({ dir, executable, cycles }: ConfOptions): string {
  return `[sdl]
autolock=false
usescancodes=true

[dosbox]
machine=svga_s3
memsize=16
captures=capture

[cpu]
core=auto
cputype=auto
cycles=fixed ${Math.max(1000, Math.round(cycles))}
cycleup=1000
cycledown=1000

[mixer]
nosound=false
rate=44100
blocksize=1024
prebuffer=20

[render]
frameskip=0
aspect=false
scaler=none

[sblaster]
sbtype=sb16
sbbase=220
irq=7
dma=1
hdma=5
mixer=true
oplmode=auto
oplemu=default
oplrate=44100

[gus]
gus=false

[speaker]
pcspeaker=true
tandy=auto

[joystick]
joysticktype=none

[serial]
serial1=dummy
serial2=dummy
serial3=disabled
serial4=disabled

[dos]
xms=true
ems=true
umb=true

[ipx]
ipx=false

[autoexec]
mount c .
c:
cd ${dir}
${executable.toUpperCase()}
`;
}
