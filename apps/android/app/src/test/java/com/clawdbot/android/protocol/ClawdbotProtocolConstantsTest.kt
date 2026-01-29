package com.clawdbot.android.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class crocbotProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", crocbotCanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", crocbotCanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", crocbotCanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", crocbotCanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", crocbotCanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", crocbotCanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", crocbotCanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", crocbotCanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", crocbotCapability.Canvas.rawValue)
    assertEquals("camera", crocbotCapability.Camera.rawValue)
    assertEquals("screen", crocbotCapability.Screen.rawValue)
    assertEquals("voiceWake", crocbotCapability.VoiceWake.rawValue)
  }

  @Test
  fun screenCommandsUseStableStrings() {
    assertEquals("screen.record", crocbotScreenCommand.Record.rawValue)
  }
}
