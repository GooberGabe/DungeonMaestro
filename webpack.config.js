const path = require('path');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  entry: './main.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  },
  target: 'electron-main',
  plugins: [
    ...(process.env.ANALYZE ? [new BundleAnalyzerPlugin()] : [])
  ],
  node: {
    __dirname: false,
    __filename: false
  }
};