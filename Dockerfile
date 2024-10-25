# Use Node.js 18 as the base image
FROM node:18

# Create and set the working directory
WORKDIR /usr/src/app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the app files
COPY . .

# Expose the port that the bot server listens on
EXPOSE 5000

# Start the bot with both the bot launch and the express server
CMD ["node", "bot.js"]
