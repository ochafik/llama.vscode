const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: 'development',
  devtool: 'source-map',
  entry: './src/webview-ui/index.tsx',
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'index.js',
    libraryTarget: 'var',
    library: 'index',
    clean: true, // Clean the output directory before emit
  },
  plugins: [
    // Force React to use development mode
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('development')
    }),
  ],
  externals: {
    vscode: 'commonjs vscode', // Exclude vscode module from the bundle
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    alias: {
      // Add aliases if needed for easier imports
      '@webview-ui': path.resolve(__dirname, 'src/webview-ui'),
    },
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            compilerOptions: {
              module: 'esnext', // Override module setting for better tree shaking
            },
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      // Add rule for image files if needed
      {
        test: /\.(png|jpg|gif|svg)$/i,
        type: 'asset/resource',
      },
    ],
  },
  performance: {
    hints: false, // Disable size warnings for entry points and assets
  },
  optimization: {
    minimize: process.env.NODE_ENV === 'production', // Only minimize in production
  },
};
