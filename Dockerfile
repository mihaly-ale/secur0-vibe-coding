FROM node:22

WORKDIR /usr/src/app

# Only copy package files first
COPY package*.json ./

# This will compile better-sqlite3 specifically for the container
RUN npm install

# Now copy the rest of your app (server.js, frontend folder, etc.)
COPY . .

EXPOSE 3000

CMD [ "node", "server.js" ]
