# Use an official Node.js runtime as a parent image
FROM node:18

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# If you're using Puppeteer or Playwright, you might need some extra dependencies
RUN apt-get update && apt-get install -y \
    wget \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Expose the port the app runs on (if necessary)
EXPOSE 3000

# Command to start the bot
CMD ["node", "index.js"]
