import type { Direction } from './types';

export interface SpriteDef {
  filename: string;
  connections?: Direction[];
}

export interface RuntimeSpriteData {
  base: SpriteDef;
  water: SpriteDef;
  farm: SpriteDef[];
  farmHouses: SpriteDef[];
  forest: SpriteDef[];
  road: SpriteDef[];
  rail: SpriteDef[];
  monorail: SpriteDef[];
  station: SpriteDef;
  depot: SpriteDef;
  port: SpriteDef[];
  airport: SpriteDef;
  residential: SpriteDef[];
  commercialLow: SpriteDef[];
  commercialMid: SpriteDef[];
  stackable: SpriteDef[];
  roofCaps: SpriteDef[];
  industry: SpriteDef[];
  warehouse: {
    roof: SpriteDef;
    front: SpriteDef;
    wallRoof: SpriteDef;
    wallFront: SpriteDef;
  };
  purchased: SpriteDef;
}

const sprite = (filename: string, connections?: Direction[]): SpriteDef => ({ filename, connections });

export const SPRITE_DATA: RuntimeSpriteData = {
  base: sprite('gfx_00194_tile_37f2_direct_eff_004_slot_004_37f2_direct.png'),
  water: sprite('gfx_00276_tile_37f2_direct_eff_052_slot_052_37f2_direct.png'),
  farm: [
    sprite('gfx_00714_tile_37f2_direct_eff_396_slot_396_37f2_direct.png'),
    sprite('gfx_00716_tile_37f2_direct_eff_398_slot_398_37f2_direct.png'),
  ],
  farmHouses: [
    sprite('gfx_00486_tile_37f2_direct_eff_227_slot_227_37f2_direct.png'),
    sprite('gfx_00488_tile_37f2_direct_eff_228_slot_228_37f2_direct.png'),
    sprite('gfx_00490_tile_37f2_direct_eff_229_slot_229_37f2_direct.png'),
    sprite('gfx_00746_tile_37f2_direct_eff_422_slot_422_37f2_direct.png'),
    sprite('gfx_00748_tile_37f2_direct_eff_423_slot_423_37f2_direct.png'),
    sprite('gfx_00762_tile_37f2_direct_eff_430_slot_430_37f2_direct.png'),
    sprite('gfx_00764_tile_37f2_direct_eff_431_slot_431_37f2_direct.png'),
    sprite('gfx_00788_tile_37f2_direct_eff_473_slot_473_37f2_direct.png'),
  ],
  forest: [
    sprite('gfx_00726_tile_37f2_direct_eff_408_slot_408_37f2_direct.png'),
    sprite('gfx_00728_tile_37f2_direct_eff_409_slot_409_37f2_direct.png'),
    sprite('gfx_00730_tile_37f2_direct_eff_410_slot_410_37f2_direct.png'),
    sprite('gfx_00732_tile_37f2_direct_eff_411_slot_411_37f2_direct.png'),
    sprite('gfx_00734_tile_37f2_direct_eff_412_slot_412_37f2_direct.png'),
    sprite('gfx_00736_tile_37f2_direct_eff_413_slot_413_37f2_direct.png'),
  ],
  road: [
    sprite('gfx_00388_tile_37f2_direct_eff_140_slot_140_37f2_direct.png', ['SE', 'NW']),
    sprite('gfx_00390_tile_37f2_direct_eff_142_slot_142_37f2_direct.png', ['NE', 'SE', 'SW', 'NW']),
    sprite('gfx_00392_tile_37f2_direct_eff_143_slot_143_37f2_direct.png', ['SE', 'SW']),
    sprite('gfx_00394_tile_37f2_direct_eff_144_slot_144_37f2_direct.png', ['SW', 'NW']),
    sprite('gfx_00396_tile_37f2_direct_eff_145_slot_145_37f2_direct.png', ['NE', 'NW']),
  ],
  rail: [
    sprite('gfx_00292_tile_37f2_direct_eff_064_slot_064_37f2_direct.png', ['N', 'S']),
    sprite('gfx_00294_tile_37f2_direct_eff_065_slot_065_37f2_direct.png', ['SE', 'NW']),
    sprite('gfx_00296_tile_37f2_direct_eff_066_slot_066_37f2_direct.png', ['E', 'W']),
    sprite('gfx_00302_tile_37f2_direct_eff_072_slot_072_37f2_direct.png', ['N', 'SE']),
    sprite('gfx_00304_tile_37f2_direct_eff_073_slot_073_37f2_direct.png', ['E', 'NW']),
    sprite('gfx_00306_tile_37f2_direct_eff_076_slot_076_37f2_direct.png', ['S', 'NW']),
    sprite('gfx_00308_tile_37f2_direct_eff_077_slot_077_37f2_direct.png', ['SE', 'W']),
    sprite('gfx_00310_tile_37f2_direct_eff_080_slot_080_37f2_direct.png', ['N', 'SE', 'S']),
    sprite('gfx_00312_tile_37f2_direct_eff_081_slot_081_37f2_direct.png', ['E', 'SE', 'NW']),
    sprite('gfx_00314_tile_37f2_direct_eff_082_slot_082_37f2_direct.png', ['NE', 'E', 'W']),
    sprite('gfx_00316_tile_37f2_direct_eff_083_slot_083_37f2_direct.png', ['N', 'NE', 'SW']),
    sprite('gfx_00318_tile_37f2_direct_eff_084_slot_084_37f2_direct.png', ['N', 'S', 'NW']),
    sprite('gfx_00320_tile_37f2_direct_eff_085_slot_085_37f2_direct.png', ['SE', 'W', 'NW']),
    sprite('gfx_00322_tile_37f2_direct_eff_086_slot_086_37f2_direct.png', ['E', 'SW', 'W']),
    sprite('gfx_00324_tile_37f2_direct_eff_087_slot_087_37f2_direct.png', ['NE', 'S', 'SW']),
  ],
  monorail: [
    sprite('gfx_00326_tile_37f2_direct_eff_096_slot_096_37f2_direct.png', ['N', 'S']),
    sprite('gfx_00328_tile_37f2_direct_eff_097_slot_097_37f2_direct.png', ['SE', 'NW']),
    sprite('gfx_00330_tile_37f2_direct_eff_098_slot_098_37f2_direct.png', ['E', 'W']),
    sprite('gfx_00340_tile_37f2_direct_eff_104_slot_104_37f2_direct.png', ['N', 'SE']),
    sprite('gfx_00342_tile_37f2_direct_eff_105_slot_105_37f2_direct.png', ['E', 'NW']),
    sprite('gfx_00344_tile_37f2_direct_eff_108_slot_108_37f2_direct.png', ['S', 'NW']),
    sprite('gfx_00346_tile_37f2_direct_eff_109_slot_109_37f2_direct.png', ['SE', 'W']),
  ],
  station: sprite('gfx_00460_tile_37f2_direct_eff_211_slot_211_37f2_direct.png'),
  depot: sprite('gfx_00206_tile_37f2_direct_eff_012_slot_012_37f2_direct.png'),
  port: [
    sprite('gfx_00216_tile_37f2_direct_eff_017_slot_017_37f2_direct.png'),
    sprite('gfx_00228_tile_37f2_direct_eff_028_slot_028_37f2_direct.png'),
  ],
  airport: sprite('gfx_00412_tile_37f2_direct_eff_177_slot_177_37f2_direct.png'),
  residential: [
    sprite('gfx_00264_tile_37f2_direct_eff_046_slot_046_37f2_direct.png'),
    sprite('gfx_00266_tile_37f2_direct_eff_047_slot_047_37f2_direct.png'),
    sprite('gfx_00268_tile_37f2_direct_eff_048_slot_048_37f2_direct.png'),
    sprite('gfx_00270_tile_37f2_direct_eff_049_slot_049_37f2_direct.png'),
    sprite('gfx_00398_tile_37f2_direct_eff_147_slot_147_37f2_direct.png'),
    sprite('gfx_00400_tile_37f2_direct_eff_148_slot_148_37f2_direct.png'),
    sprite('gfx_00402_tile_37f2_direct_eff_149_slot_149_37f2_direct.png'),
    sprite('gfx_00480_tile_37f2_direct_eff_224_slot_224_37f2_direct.png'),
    sprite('gfx_00482_tile_37f2_direct_eff_225_slot_225_37f2_direct.png'),
    sprite('gfx_00484_tile_37f2_direct_eff_226_slot_226_37f2_direct.png'),
    sprite('gfx_00488_tile_37f2_direct_eff_228_slot_228_37f2_direct.png'),
    sprite('gfx_00490_tile_37f2_direct_eff_229_slot_229_37f2_direct.png'),
    sprite('gfx_00746_tile_37f2_direct_eff_422_slot_422_37f2_direct.png'),
    sprite('gfx_00748_tile_37f2_direct_eff_423_slot_423_37f2_direct.png'),
    sprite('gfx_00762_tile_37f2_direct_eff_430_slot_430_37f2_direct.png'),
    sprite('gfx_00764_tile_37f2_direct_eff_431_slot_431_37f2_direct.png'),
  ],
  commercialLow: [
    sprite('gfx_00496_tile_37f2_direct_eff_232_slot_232_37f2_direct.png'),
    sprite('gfx_00498_tile_37f2_direct_eff_233_slot_233_37f2_direct.png'),
    sprite('gfx_00500_tile_37f2_direct_eff_234_slot_234_37f2_direct.png'),
    sprite('gfx_00504_tile_37f2_direct_eff_236_slot_236_37f2_direct.png'),
    sprite('gfx_00506_tile_37f2_direct_eff_237_slot_237_37f2_direct.png'),
    sprite('gfx_00626_tile_37f2_direct_eff_307_slot_307_37f2_direct.png'),
  ],
  commercialMid: [
    sprite('gfx_00512_tile_37f2_direct_eff_240_slot_240_37f2_direct.png'),
    sprite('gfx_00514_tile_37f2_direct_eff_241_slot_241_37f2_direct.png'),
    sprite('gfx_00516_tile_37f2_direct_eff_242_slot_242_37f2_direct.png'),
    sprite('gfx_00518_tile_37f2_direct_eff_243_slot_243_37f2_direct.png'),
    sprite('gfx_00520_tile_37f2_direct_eff_244_slot_244_37f2_direct.png'),
    sprite('gfx_00522_tile_37f2_direct_eff_245_slot_245_37f2_direct.png'),
    sprite('gfx_00528_tile_37f2_direct_eff_248_slot_248_37f2_direct.png'),
    sprite('gfx_00530_tile_37f2_direct_eff_249_slot_249_37f2_direct.png'),
    sprite('gfx_00532_tile_37f2_direct_eff_250_slot_250_37f2_direct.png'),
    sprite('gfx_00766_tile_37f2_direct_eff_432_slot_432_37f2_direct.png'),
    sprite('gfx_00768_tile_37f2_direct_eff_433_slot_433_37f2_direct.png'),
    sprite('gfx_00770_tile_37f2_direct_eff_434_slot_434_37f2_direct.png'),
    sprite('gfx_00772_tile_37f2_direct_eff_435_slot_435_37f2_direct.png'),
    sprite('gfx_00774_tile_37f2_direct_eff_436_slot_436_37f2_direct.png'),
  ],
  stackable: [
    sprite('gfx_00544_tile_37f2_direct_eff_257_slot_257_37f2_direct.png'),
    sprite('gfx_00546_tile_37f2_direct_eff_258_slot_258_37f2_direct.png'),
    sprite('gfx_00548_tile_37f2_direct_eff_259_slot_259_37f2_direct.png'),
    sprite('gfx_00550_tile_37f2_direct_eff_260_slot_260_37f2_direct.png'),
    sprite('gfx_00552_tile_37f2_direct_eff_261_slot_261_37f2_direct.png'),
    sprite('gfx_00554_tile_37f2_direct_eff_262_slot_262_37f2_direct.png'),
    sprite('gfx_00556_tile_37f2_direct_eff_263_slot_263_37f2_direct.png'),
    sprite('gfx_00558_tile_37f2_direct_eff_264_slot_264_37f2_direct.png'),
    sprite('gfx_00560_tile_37f2_direct_eff_265_slot_265_37f2_direct.png'),
    sprite('gfx_00562_tile_37f2_direct_eff_266_slot_266_37f2_direct.png'),
    sprite('gfx_00564_tile_37f2_direct_eff_267_slot_267_37f2_direct.png'),
    sprite('gfx_00566_tile_37f2_direct_eff_268_slot_268_37f2_direct.png'),
    sprite('gfx_00568_tile_37f2_direct_eff_269_slot_269_37f2_direct.png'),
    sprite('gfx_00570_tile_37f2_direct_eff_270_slot_270_37f2_direct.png'),
    sprite('gfx_00572_tile_37f2_direct_eff_271_slot_271_37f2_direct.png'),
    sprite('gfx_00574_tile_37f2_direct_eff_272_slot_272_37f2_direct.png'),
    sprite('gfx_00576_tile_37f2_direct_eff_273_slot_273_37f2_direct.png'),
    sprite('gfx_00578_tile_37f2_direct_eff_274_slot_274_37f2_direct.png'),
  ],
  roofCaps: [
    sprite('gfx_00580_tile_37f2_direct_eff_275_slot_275_37f2_direct.png'),
    sprite('gfx_00582_tile_37f2_direct_eff_276_slot_276_37f2_direct.png'),
    sprite('gfx_00586_tile_37f2_direct_eff_278_slot_278_37f2_direct.png'),
    sprite('gfx_00588_tile_37f2_direct_eff_279_slot_279_37f2_direct.png'),
  ],
  industry: [
    sprite('gfx_00206_tile_37f2_direct_eff_012_slot_012_37f2_direct.png'),
    sprite('gfx_00208_tile_37f2_direct_eff_013_slot_013_37f2_direct.png'),
    sprite('gfx_00210_tile_37f2_direct_eff_014_slot_014_37f2_direct.png'),
    sprite('gfx_00212_tile_37f2_direct_eff_015_slot_015_37f2_direct.png'),
    sprite('gfx_00214_tile_37f2_direct_eff_016_slot_016_37f2_direct.png'),
  ],
  warehouse: {
    roof: sprite('gfx_00614_tile_37f2_direct_eff_300_slot_300_37f2_direct.png'),
    front: sprite('gfx_00616_tile_37f2_direct_eff_301_slot_301_37f2_direct.png'),
    wallRoof: sprite('gfx_00618_tile_37f2_direct_eff_302_slot_302_37f2_direct.png'),
    wallFront: sprite('gfx_00620_tile_37f2_direct_eff_303_slot_303_37f2_direct.png'),
  },
  purchased: sprite('gfx_00195_tile_37f2_direct_eff_005_slot_005_37f2_direct.png'),
};
