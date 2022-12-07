const { CleanWebpackPlugin } = require('clean-webpack-plugin')  // webpack4之后的引入方式
const { merge } = require('webpack-merge');
const paths = require('./paths');
const common = require('./webpack.common')

module.exports = merge(common, {
    // 模式
    mode: 'production',
    // 开发工具，开启 source map，编译调试
    // devtool: 'source-map',

    devtool: false,

    plugins: [
        // 打包时，把output下配置的dist目录文件内容先清除
        new CleanWebpackPlugin(),
    ]
})
