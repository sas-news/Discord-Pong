import { DiscordSDK } from "@discord/embedded-app-sdk";

import rocketLogo from "/rocket.png";
import "./style.css";

// Will eventually store the authenticated user's access_token
let auth;

const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);

const setupDiscordSdk = async () => {
  await discordSdk.ready();
  console.log("Discord SDK is ready");

  // Subscribe to the GET_SELECTED_VOICE_CHANNEL event
  discordSdk.subscribe("GET_SELECTED_VOICE_CHANNEL", (event) => {
    console.log("Selected Voice Channel:", event);
  });

  // Authorize with Discord Client
  const { code } = await discordSdk.commands.authorize({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify", "guilds", "guilds.members.read"], // Added guilds.members.read scope
  });

  // Retrieve an access_token from your activity's server
  const response = await fetch("/.proxy/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
    }),
  });
  const { access_token } = await response.json();

  // Authenticate with Discord client (using the access_token)
  auth = await discordSdk.commands.authenticate({
    access_token,
  });

  if (auth == null) {
    throw new Error("Authenticate command failed");
  }

  console.log("Authenticated with access token:", auth.access_token); // Log the access token for debugging
};

setupDiscordSdk().then(() => {
  console.log("Discord SDK is authenticated");

  appendVoiceChannelName();
  appendGuildAvatar();
  appendPlayer();
});

const appendVoiceChannelName = async () => {
  const app = document.querySelector("#app");

  let activityChannelName = "Unknown";

  // Requesting the channel in GDMs (when the guild ID is null) requires
  // the dm_channels.read scope which requires Discord approval.
  if (discordSdk.channelId != null && discordSdk.guildId != null) {
    // Over RPC collect info about the channel
    const channel = await discordSdk.commands.getChannel({
      channel_id: discordSdk.channelId,
    });
    if (channel.name != null) {
      activityChannelName = channel.name;
    }
  }

  // Update the UI with the name of the current voice channel
  const textTagString = `Activity Channel: "${activityChannelName}"`;
  const textTag = document.createElement("p");
  textTag.textContent = textTagString;
  app.appendChild(textTag);
};

const appendPlayer = async () => {
  const app = document.querySelector("#app");

  try {
    const { participants } =
      await discordSdk.commands.getInstanceConnectedParticipants();
    // participants = [{"id":"981502870971105320","username":"sasnews","global_name":"SAS NEWS","discriminator":"0","avatar":"8c859c4bb63ce7d4b225ee64d3a1130b","flags":160,"bot":false,"avatar_decoration_data":{"asset":"a_aa2dc0f4bfa22bd81ea3990c52d29a96"},"premium_type":0}]
    // メンバーのリスト<li>を表示
    const participantList = document.createElement("ul");
    participants.forEach((member) => {
      const listItem = document.createElement("li");
      listItem.textContent = member.username;
      participantList.appendChild(listItem);
    });
    app.appendChild(participantList);
  } catch (error) {
    console.error("Failed to load members:", error);
  }
};

const appendGuildAvatar = async () => {
  const app = document.querySelector("#app");

  // 1. From the HTTP API fetch a list of all of the user's guilds
  const guilds = await fetch(`https://discord.com/api/v10/users/@me/guilds`, {
    headers: {
      // NOTE: we're using the access_token provided by the "authenticate" command
      Authorization: `Bearer ${auth.access_token}`,
      "Content-Type": "application/json",
    },
  }).then((response) => response.json());

  // 2. Find the current guild's info, including it's "icon"
  const currentGuild = guilds.find((g) => g.id === discordSdk.guildId);

  // 3. Append to the UI an img tag with the related information
  if (currentGuild != null) {
    const guildImg = document.createElement("img");
    guildImg.setAttribute(
      "src",
      // More info on image formatting here: https://discord.com/developers/docs/reference#image-formatting
      `https://cdn.discordapp.com/icons/${currentGuild.id}/${currentGuild.icon}.webp?size=128`
    );
    guildImg.setAttribute("width", "128px");
    guildImg.setAttribute("height", "128px");
    guildImg.setAttribute("style", "border-radius: 50%;");
    app.appendChild(guildImg);
  }
};

document.querySelector("#app").innerHTML = `
  <div>
    <img src="${rocketLogo}" class="logo" alt="Discord" />
    <h1>Hello, World!</h1>
  </div>
`;
