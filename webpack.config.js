const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

const isProduction = process.env.NODE_ENV === 'production';

// Base entry points (always included)
const baseEntry = {
  background: './src/background.ts',
  popup: './src/popup.ts',
  content: './src/content.ts',
  settings: './src/settings.ts'
};

// Development-only entry points
const devEntry = {
  debug: './src/debug.ts'
};

module.exports = {
  mode: isProduction ? 'production' : 'development',
  devtool: isProduction ? false : 'source-map',
  entry: isProduction ? baseEntry : { ...baseEntry, ...devEntry },
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
            loader: 'babel-loader',
            options: {
              plugins: isProduction ? ['transform-remove-console'] : []
            }
          },
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