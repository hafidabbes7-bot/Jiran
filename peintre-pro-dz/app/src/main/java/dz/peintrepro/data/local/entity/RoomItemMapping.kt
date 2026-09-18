package dz.peintrepro.data.local.entity

import dz.peintrepro.domain.calc.RoomDimensions
import dz.peintrepro.domain.calc.SurfaceCalculator
import dz.peintrepro.domain.calc.SurfaceResult

/** Passerelle entre la pièce enregistrée en base et le calculateur de surfaces. */
fun RoomItemEntity.toDimensions(): RoomDimensions = RoomDimensions(
    length = length,
    width = width,
    height = height,
    doorCount = doorCount,
    doorWidth = doorWidth,
    doorHeight = doorHeight,
    windowCount = windowCount,
    windowWidth = windowWidth,
    windowHeight = windowHeight,
    manualWallArea = manualWallArea,
    manualCeilingArea = manualCeilingArea
)

fun RoomItemEntity.surfaces(): SurfaceResult = SurfaceCalculator.compute(toDimensions())
