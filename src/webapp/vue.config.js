const path = require("path");
module.exports = {
  outputDir: path.resolve(__dirname, "../../target/webapp"),
  publicPath: './',
  configureWebpack:{
    performance: { hints: false }
  },
  devServer: {
    port: 8000,
    proxy: {
      '/sim': {
        target: 'https://localhost:7777/sim',
        changeOrigin: true,
        pathRewrite: {
          '^/sim': ''
        }
      },
      '/workspace': {
        target: 'https://localhost:7777/workspace',
        changeOrigin: true,
        pathRewrite: {
          '^/workspace': ''
        }
      }
    }
  }
}
