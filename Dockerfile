FROM node:12-alpine

# Set the working directory
WORKDIR /app/agent-api-simulator

# Copy the project
COPY . .

# Install dependencies

RUN npm install

# Build

RUN npm run build

# Expose the ports
EXPOSE 7777
EXPOSE 3000
EXPOSE 8080

# Start
CMD [ "npm", "start" ] 