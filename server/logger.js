const winston = require("winston");
const { format } = winston;

const logger = winston.createLogger({
  level: "info",
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({
      filename: "logs/verbose.log",
      level: "verbose",
    }),
    new winston.transports.File({ filename: "logs/info.log", level: "info" }),
  ],
});

logger.add(
  new winston.transports.Console({
    level: "info",
    format: format.combine(format.colorize(), format.simple()),
  })
);

module.exports = logger;
