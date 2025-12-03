// if (workflow.isCritical)表示只有攻击检定结果为重击触发，可删除
if (workflow.isCritical) { 
	// Sequence mod的API
	new Sequence()
	// 画布方面的调整，数值可变动
	.canvasPan()
		.atLocation(token)
		.speed(3500)
		.scale(0.8)
		.lockView(2000)
	// webm视频效果方面的调整，数值可变动
	.effect()
		.file("modules/door-cutin/assets/cutin/videos/p5-cutin.webm")
		.atLocation(token)
			.aboveLighting()
			.xray()
		.scale(0.6)
		.waitUntilFinished(-1000)
	// 音效，可调整音量
	.sound("modules/door-cutin/assets/sfx/p5.aac")
		.volume(1.0)
	.play()
}