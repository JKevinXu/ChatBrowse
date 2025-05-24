const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  devtool: false,
  entry: {
    background: './src/background.ts',
    popup: './src/popup.ts',
    content: './src/content.ts',
    debug: './src/debug.ts',
    settings: './src/settings.ts',
    'action-system': './src/action-system.ts',
    'action-content': './src/action-content.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true
            }
          }
        ],
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@content': path.resolve(__dirname, 'src/content'),
      '@services': path.resolve(__dirname, 'src/services')
    }
  },
  optimization: {
    minimize: true
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'public', to: '.' },
      ],
    }),
  ],
}; 