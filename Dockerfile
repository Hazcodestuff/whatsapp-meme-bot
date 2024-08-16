# Use the official Node.js image as the base image
FROM node:18

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (or yarn.lock) to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your application code to the working directory
COPY . .

# Expose the port your app runs on (if applicable)
# EXPOSE 8080

# Command to run your bot
CMD ["node", "index.js"]

# If you have any specific environment variables, you might need to set them here
# ENV SOME_ENV_VAR=some_value
