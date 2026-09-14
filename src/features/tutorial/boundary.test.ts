import { describe, expect, it } from 'vitest'
import analyticsSource from './tutorialAnalytics.ts?raw'
import catalogSource from './lessonCatalog.ts?raw'
import gradingSource from './tutorialGrading.ts?raw'
import reducerSource from './tutorialReducer.ts?raw'
import scenariosSource from './scenarios.ts?raw'
import guidedSource from './guidedRound.ts?raw'
import fixedSource from './fixedDeck.ts?raw'
import cardsSource from './tutorialCards.ts?raw'
import copySource from './tutorialCopy.ts?raw'
import typesSource from './tutorialTypes.ts?raw'
import completeSource from './completeRound.ts?raw'
import validateSource from './validateCatalog.ts?raw'

const FEATURE_SOURCES = [
  catalogSource, gradingSource, reducerSource, scenariosSource,
  guidedSource, fixedSource, cardsSource, copySource, typesSource,
  completeSource, validateSource, analyticsSource,
]

describe("tutorial module boundary", () => {
  it("never imports thePlayer or gamePlayer", () => {
    for (const source of FEATURE_SOURCES) {
      expect(source).not.toMatch(/thePlayer|gamePlayer/)
    }
  })

  it("only imports PCard as a type from gameSlice", () => {
    for (const source of FEATURE_SOURCES) {
      const sliceLines = source.split("\n").filter((line) => line.includes("gameSlice"))
      for (const line of sliceLines) {
        expect(line).toMatch(/import type/)
      }
    }
  })

  it("keeps analytics as a null sink", () => {
    expect(analyticsSource).not.toMatch(/fetch\(|XMLHttpRequest|navigator\.sendBeacon/)
    expect(analyticsSource).toMatch(/if \(!sink\)/)
  })
})
