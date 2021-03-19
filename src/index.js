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
    AutoCursorModes,
    AxisScrollStrategies,
    AxisTickStrategies,
    DataPatterns,
    ColorRGBA,
    ColorHSV,
    Themes,
} = lcjs

const DATA_FREQUENCY_HZ = 1000
const CHANNELS_AMOUNT = 10
const xIntervalMax = 15 * DATA_FREQUENCY_HZ
const channelIntervalY = 2 // [-1, 1]

const chart = lightningChart()
    .ChartXY({
        // Theme: Themes.dark,
    })
    .setTitle(`Multi-channel real-time monitoring (${CHANNELS_AMOUNT} chs, ${DATA_FREQUENCY_HZ} Hz)`)
    .setAutoCursorMode(AutoCursorModes.disabled)
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
    const nSeries = chart
        .addLineSeries({
            dataPattern: DataPatterns.horizontalProgressive,
        })
        .setStrokeStyle(new SolidLine({
            thickness: 1,
            fillStyle: new SolidFill({color: ColorHSV( iChannel * 60 )})
        }))
        .setMouseInteractions(false)
        .setMaxPointCount(xIntervalMax)

    return nSeries
})

const dcThresholdBand = axisX.addConstantLine().setStrokeStyle(
    new SolidLine({
        thickness: 10,
        fillStyle: new SolidFill({ color: ColorRGBA(255,0,0,50) }),
    }),
)

// Define unique signals that will be used for channels.
const signals = [
    { length: 1000 * 2 * Math.PI, func: (x) => Math.sin(x / 1000) },
    { length: 1000 * 2 * Math.PI, func: (x) => Math.cos(x / 1000) },
    { length: 2000 * 2 * Math.PI, func: (x) => Math.cos(x / 2000) + Math.sin(x / 1000) },
    { length: 2000 * 2 * Math.PI, func: (x) => Math.sin(x / 500) + Math.cos(x / 2000) },
    { length: 2000 * 2 * Math.PI, func: (x) => Math.sin(x / 1000) * Math.cos(x / 2000) },
    { length: 4500 * 2 * Math.PI, func: (x) => Math.cos(x / 4500) },
    { length: 8000 * 2 * Math.PI, func: (x) => Math.sin(x / 8000) },
    { length: 6500 * 2 * Math.PI, func: (x) => Math.sin(x / 2000) * Math.cos(x / 6500) },
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
                const y = iChannel * channelIntervalY + ySignal
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
let tStart = Date.now()
let frames = 0
let fps = 0
const title = chart.getTitle()
const recordFrame = () => {
    frames++
    const tNow = Date.now()
    fps = 1000 / ((tNow - tStart) / frames)
    sub_recordFrame = requestAnimationFrame(recordFrame)

    chart.setTitle(`${title} (FPS: ${fps.toFixed(1)})`)
}
let sub_recordFrame = requestAnimationFrame(recordFrame)
setInterval(() => {
    tStart = Date.now()
    frames = 0
}, 5000)
