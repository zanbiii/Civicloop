'use client';

import AmbientBackdrop from './AmbientBackdrop';
import BootLoader from './BootLoader';
import CustomCursor from './CustomCursor';
import ParticleField from './ParticleField';
import PointerFx from './PointerFx';

/** Everything that sits around the app rather than inside it: backdrop, particles, cursor, boot. */
export default function FxLayer() {
  return (
    <>
      <AmbientBackdrop />
      <ParticleField />
      <PointerFx />
      <CustomCursor />
      <BootLoader />
    </>
  );
}
