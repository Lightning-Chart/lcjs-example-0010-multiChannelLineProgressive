/*
 * LightningChartJS example for multi-channel real-time monitoring Line Chart.
 */

// Import LightningChartJS
const lcjs = require('@lightningchart/lcjs')

// Import xydata
const xydata = require('@lightningchart/xydata')

// Import data Generator
const { createProgressiveFunctionGenerator } = xydata

// Extract required parts from LightningChartJS.
const { lightningChart, SolidFill, SolidLine, AxisScrollStrategies, AxisTickStrategies, ColorRGBA, emptyFill, Themes } = lcjs

const DATA_FREQUENCY_HZ = 1000
const CHANNELS_AMOUNT = 10
const xIntervalMax = 30 * DATA_FREQUENCY_HZ
const channelIntervalY = 2 // [-1, 1]

const chart = lightningChart({
            resourcesBaseUrl: new URL(document.head.baseURI).origin + new URL(document.head.baseURI).pathname + 'resources/',
        })
    .ChartXY({
        theme: Themes[new URLSearchParams(window.location.search).get('theme') || 'darkGold'] || undefined,
    })
    .setTitle(`Multi-channel real-time monitoring (${CHANNELS_AMOUNT} chs, ${DATA_FREQUENCY_HZ} Hz)`)
const axisX = chart
    .getDefaultAxisX()
    .setScrollStrategy(AxisScrollStrategies.progressive)
    .setDefaultInterval((state) => ({ end: state.dataMax, start: (state.dataMax ?? 0) - xIntervalMax, stopAxisAfter: false }))
    .setTitle('Data points per channel')
const axisY = chart
    .getDefaultAxisY()
    .setTickStrategy(AxisTickStrategies.Empty)
    .setTitle('< Channels >')
    .setScrollStrategy(AxisScrollStrategies.expansion)
    .setInterval({ start: -channelIntervalY / 2, end: CHANNELS_AMOUNT * channelIntervalY, stopAxisAfter: false })

const series = new Array(CHANNELS_AMOUNT).fill(0).map((_, iChannel) => {
    // Create line series optimized for regular progressive X data.
    const nSeries = chart
        .addPointLineAreaSeries({
            dataPattern: 'ProgressiveX',
        })
        .setName(`Channel ${iChannel + 1}`)
        .setAreaFillStyle(emptyFill)
        // Use -1 thickness for best performance, especially on low end devices like mobile / laptops.
        .setStrokeStyle((style) => style.setThickness(-1))
        .setMouseInteractions(false)
        .setMaxSampleCount(xIntervalMax)

    // Add custom tick for each channel.
    chart
        .getDefaultAxisY()
        .addCustomTick()
        .setValue((CHANNELS_AMOUNT - (1 + iChannel)) * channelIntervalY)
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
chart
    .addLegendBox()
    .add(chart)
    // Dispose example UI elements automatically if they take too much space. This is to avoid bad UI on mobile / etc. devices.
    .setAutoDispose({
        type: 'max-width',
        maxWidth: 0.3,
    })

// Define unique signals that will be used for channels.
const signals = [
    { length: 100 * 2 * Math.PI, func: (x) => Math.sin(x / 100) },
    { length: 100 * 2 * Math.PI, func: (x) => Math.cos(x / 100) },
    {
        length: 200 * 2 * Math.PI,
        func: (x) => Math.cos(x / 200) + Math.sin(x / 100),
    },
    {
        length: 200 * 2 * Math.PI,
        func: (x) => Math.sin(x / 50) + Math.cos(x / 200),
    },
    {
        length: 200 * 2 * Math.PI,
        func: (x) => Math.sin(x / 100) * Math.cos(x / 200),
    },
    { length: 450 * 2 * Math.PI, func: (x) => Math.cos(x / 450) },
    { length: 800 * 2 * Math.PI, func: (x) => Math.sin(x / 800) },
    {
        length: 650 * 2 * Math.PI,
        func: (x) => Math.sin(x / 200) * Math.cos(x / 650),
    },
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
    // Stream data into series.
    let tStart = window.performance.now()
    let pushedDataCount = 0
    const xStep = 1000 / DATA_FREQUENCY_HZ
    const streamData = () => {
        const tNow = window.performance.now()
        // NOTE: This code is for example purposes (streaming stable data rate without destroying browser when switching tabs etc.)
        // In real use cases, data should be pushed in when it comes.
        const shouldBeDataPointsCount = Math.floor((DATA_FREQUENCY_HZ * (tNow - tStart)) / 1000)
        const newDataPointsCount = Math.min(shouldBeDataPointsCount - pushedDataCount, 1000) // Add max 1000 data points per frame into a series. This prevents massive performance spikes when switching tabs for long times
        const seriesNewDataPoints = []
        for (let iChannel = 0; iChannel < series.length; iChannel++) {
            const dataSet = dataSets[iChannel % dataSets.length]
            const newDataPoints = []
            for (let iDp = 0; iDp < newDataPointsCount; iDp++) {
                const x = (pushedDataCount + iDp) * xStep
                const iData = (pushedDataCount + iDp) % dataSet.length
                const ySignal = dataSet[iData]
                const y = (CHANNELS_AMOUNT - 1 - iChannel) * channelIntervalY + ySignal
                const point = { x, y }
                newDataPoints.push(point)
            }
            seriesNewDataPoints[iChannel] = newDataPoints
        }
        series.forEach((series, iChannel) => series.appendJSON(seriesNewDataPoints[iChannel]))
        pushedDataCount += newDataPointsCount
        requestAnimationFrame(streamData)
    }
    streamData()
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
