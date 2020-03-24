const merge = require('webpack-merge')

const { join } = require('path')

const WebpackProgressOraPlugin = require('webpack-progress-ora-plugin')

const { CleanWebpackPlugin } = require('clean-webpack-plugin')

const baseConfig = require('./webpack.base.config.js')

// const packageJson = require('../package.json')

const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = merge(baseConfig, {
  mode: 'production',

  entry: join(__dirname, '..', 'development', 'main.js'),

  output: {
    filename: '[name].[chunkhash].js',
    path: join(__dirname, '..', 'example'),
    publicPath: '/www/'
  },

  devtool: false,

  optimization: {
    splitChunks: {
      chunks: 'all',
    },
  },

  // externals: Object.keys(packageJson.dependencies),

  plugins: [
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: ['**/*'],
      cleanAfterEveryBuildPatterns: [],
    }),

    new WebpackProgressOraPlugin({
      clear: true,
    }),

    new HtmlWebpackPlugin({
      template: join(__dirname, '..', 'development', 'template.html'),
      filename: 'index.html',
    })
  ],
})
