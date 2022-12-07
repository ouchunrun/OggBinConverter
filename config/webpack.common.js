const {resolveApp} = require("./paths")
const webpack = require('webpack')
const paths = require("./paths")
const path = require('path')
const CopyPlugin = require('copy-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')  // webpack4之后的引入方式
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ProgressBarPlugin = require('progress-bar-webpack-plugin');

const ENV = process.env.NODE_ENV
console.log('process ENV:', ENV)

let pathsBuild = paths.build
let staticFilesToDistConfigs = [
    {
        from: paths.css,
        to: paths.build + '/css/',
    },
    {
        from: paths.icons,
        to: paths.build + '/icons/',
    },
    {
        from: paths.toBin +  '/encoderWorker.js',
        to:  paths.build + '/toBin',
    },
    {
        from: paths.toOgg +  '/oggOpusEncoderWorker.js',
        to:  paths.build + '/toOgg',
    },
    {
        from: paths.toOgg +  '/oggOpusEncoderWorker.wasm',
        to:  paths.build + '/toOgg',
    },
]
let webpackEntry = {
    convert:[
        paths.src + "/recorder.js",
        paths.src + "/encoder.js",
        "./index.js",
    ],
}

/**
 * 使用function方式return配置,用来获取argv相关参数
 * @param env 用以接收上面那种方式传递的自定义参数
 * @param argv 里面包含 webpack 的配置信息
 * @returns {}
 */
module.exports = {
    devtool: false,  // 控制如何生成map源映射
    target: 'web', // <=== 默认是 'web'，可省略
    mode: 'production',
    // mode: 'development',  // 打包的模式： production 生产模式（打包后的文件或压缩） development(开发模式，不压缩)
    entry: webpackEntry,
    output: {
        path: pathsBuild,
        filename: "[name].js",
        clean: true,            // 编译前清除目录
    },
    plugins: [
        new CopyPlugin({
            patterns: staticFilesToDistConfigs
        }),
        new ProgressBarPlugin({
            format:'  :msg [:bar] :percent (:elapsed s)'
        }),
        new HtmlWebpackPlugin({
            template: './index.html',
            filename: 'index.html',
            hash: true,
            inject: true,            // 是否将js放在body的末尾
            // chunks: ['convert'],  // 数组或者'all'，表示要将哪些chunks插入html
            // minify: false,
            minify: {
                collapseWhitespace: true,
                removeComments: true,
                removeRedundantAttributes: false,
                useShortDoctype: false,
            },
        }),
        new CleanWebpackPlugin(),  //打包时先清除dist目录
    ]
}
