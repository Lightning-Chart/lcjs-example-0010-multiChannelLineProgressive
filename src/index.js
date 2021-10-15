/*
 * LightningChartJS example for multi-channel real-time monitoring Line Chart.
 */

// Import LightningChartJS
const lcjs = require('@arction/lcjs')
// Import data Generator 
const { createProgressiveFunctionGenerator } = require('@arction/xydata')

// Extract required parts from LightningChartJS.
const {
    lightningChart,
    SolidFill,
    SolidLine,
    AxisScrollStrategies,
    AxisTickStrategies,
    ColorRGBA,
    UIElementBuilders,
    Themes,
} = lcjs

const DATA_FREQUENCY_HZ = 1000
const CHANNELS_AMOUNT = 10
const xIntervalMax = 30 * DATA_FREQUENCY_HZ
const channelIntervalY = 2 // [-1, 1]

const chart = lightningChart()
    .ChartXY({
    // theme: Themes.darkGold
    })
    .setTitle(`Multi-channel real-time monitoring (${CHANNELS_AMOUNT} chs, ${DATA_FREQUENCY_HZ} Hz)`)
const axisX = chart
    .getDefaultAxisX()
    .disableAnimations()
    .setScrollStrategy(AxisScrollStrategies.progressive)
    .setInterval(-xIntervalMax, 0)
    .setTitle('Data points per channel')
const axisY = chart.getDefaultAxisY()
    .setTickStrategy(AxisTickStrategies.Empty)
    .setTitle('< Channels >')
    .disableAnimations()
    .setScrollStrategy(AxisScrollStrategies.expansion)
    .setInterval(-channelIntervalY / 2, CHANNELS_AMOUNT * channelIntervalY)

const series = new Array(CHANNELS_AMOUNT).fill(0).map((_, iChannel) => {
    // Create line series optimized for regular progressive X data.
    const nSeries = chart.addLineSeries({
            dataPattern: {
                // pattern: 'ProgressiveX' => Each consecutive data point has increased X coordinate.
                pattern: 'ProgressiveX',
                // regularProgressiveStep: true => The X step between each consecutive data point is regular (for example, always `1.0`).
                regularProgressiveStep: true,
            }
        })
        .setName(`Channel ${iChannel + 1}`)
        // Default color, but thickness = 1
        .setStrokeStyle(style => style.setThickness(1))
        .setMouseInteractions(false)
        // Enable automatic data cleaning.
        .setMaxPointCount(xIntervalMax)

    // Add custom tick for each channel.
    chart
        .getDefaultAxisY()
        .addCustomTick(UIElementBuilders.AxisTick)
        .setValue(( CHANNELS_AMOUNT - (1 + iChannel) ) * channelIntervalY)
        .setTextFormatter(() => `Channel ${iChannel + 1}`)
        .setGridStrokeStyle(
            new SolidLine({
                thickness: 1,
                fillStyle: new SolidFill({ color: ColorRGBA(255, 255, 255, 60) }),
            }),
        )

    return nSeries
})

// Add LegendBox.
chart.addLegendBox().add(chart)
    // Dispose example UI elements automatically if they take too much space. This is to avoid bad UI on mobile / etc. devices.
    .setAutoDispose({
        type: 'max-width',
        maxWidth: 0.30,
    })

// Define unique signals that will be used for channels.
const signals = [
    { length: 100 * 2 * Math.PI, func: (x) => Math.sin(x / 100) },
    { length: 100 * 2 * Math.PI, func: (x) => Math.cos(x / 100) },
    { length: 200 * 2 * Math.PI, func: (x) => Math.cos(x / 200) + Math.sin(x / 100) },
    { length: 200 * 2 * Math.PI, func: (x) => Math.sin(x / 50) + Math.cos(x / 200) },
    { length: 200 * 2 * Math.PI, func: (x) => Math.sin(x / 100) * Math.cos(x / 200) },
    { length: 450 * 2 * Math.PI, func: (x) => Math.cos(x / 450) },
    { length: 800 * 2 * Math.PI, func: (x) => Math.sin(x / 800) },
    { length: 650 * 2 * Math.PI, func: (x) => Math.sin(x / 200) * Math.cos(x / 650) },
]

// Generate data sets for each signal.
Promise.all(
    signals.map((signal) =>
        createProgressiveFunctionGenerator()
            .setStart(0)
            .setEnd(signal.length)
            .setStep(1)
            .setSamplingFunction(signal.func)
            .generate()
            .toPromise()
            .then((data) => data.map((xy) => xy.y)),
    ),
).then((dataSets) => {
    // Push more data in each frame, while keeping a consistent amount of incoming points according to specified stream rate as Hz.
    let xPos = 0
    let tPrev = performance.now()
    let newDataModulus = 0
    const streamMoreData = () => {
        const tNow = performance.now()
        const tDelta = tNow - tPrev
        let newDataPointsCount = DATA_FREQUENCY_HZ * (tDelta / 1000) + newDataModulus
        newDataModulus = newDataPointsCount % 1
        newDataPointsCount = Math.floor(newDataPointsCount)
        const seriesNewDataPoints = []
        for (let iChannel = 0; iChannel < series.length; iChannel++) {
            const nDataset = dataSets[iChannel % (dataSets.length - 1)]
            const newDataPoints = []
            for (let iDp = 0; iDp < newDataPointsCount; iDp++) {
                const x = xPos + iDp
                const iData = x % (nDataset.length - 1)
                const ySignal = nDataset[iData]
                const y = ((CHANNELS_AMOUNT - 1) - iChannel) * channelIntervalY + ySignal
                const point = { x, y }
                newDataPoints.push(point)
            }
            seriesNewDataPoints[iChannel] = newDataPoints
        }
        series.forEach((nSeries, iSeries) => nSeries.add(seriesNewDataPoints[iSeries]))
        xPos += newDataPointsCount

        // Request next frame.
        tPrev = tNow
        requestAnimationFrame(streamMoreData)
    }
    streamMoreData()
})



// Measure FPS.
let tStart = window.performance.now()
let frames = 0
let fps = 0
const title = chart.getTitle()
const recordFrame = () => {
    frames++
    const tNow = window.performance.now()
    fps = 1000 / ((tNow - tStart) / frames)
    sub_recordFrame = requestAnimationFrame(recordFrame)

    chart.setTitle(`${title} (FPS: ${fps.toFixed(1)})`)
}
let sub_recordFrame = requestAnimationFrame(recordFrame)
setInterval(() => {
    tStart = window.performance.now()
    frames = 0
}, 5000)
