const { ProvidePlugin } = require("webpack");

module.exports = {
  entry: "./src/index.jsx",
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          }
        }
      },
      {
        test: /\.jsx$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
            plugins: [
              "syntax-jsx",
              ["@babel/plugin-transform-react-jsx", {
                pragma: "Snabbdom.createElement",
                pragmaFrag: "Array",
              }]
            ]
          }
        }
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.(png|jpe?g|gif|svg|eot|ttf|woff|woff2)$/i,
        type: "asset",
      },
    ]
  },
  plugins: [
    new ProvidePlugin({
      Snabbdom: "snabbdom-pragma"
    })
  ],
  devtool: "source-map",
}
