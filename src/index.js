require("../server.js"); // Starts the web server
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Partials
} = require('discord.js');

// Initialize Discord client with required intents and partials
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel]
});

// Path to the local JSON file storing characters
const CHARACTERS_PATH = path.join(__dirname, 'characters.json');

let localCharacters = [];
try {
  const data = fs.readFileSync(CHARACTERS_PATH, 'utf8');
  localCharacters = JSON.parse(data);
  console.log(`✅ Successfully loaded ${localCharacters.length} characters from local JSON.`);
} catch (error) {
  console.error('❌ Error reading characters.json:', error);
  localCharacters = [];
}

// Create a set of lowercase names for quick duplicate checks
const existingCharacterNames = new Set(localCharacters.map(c => c.name.toLowerCase()));

// Function to pick a random character from the local list
function pickRandomLocalCharacter() {
  if (localCharacters.length === 0) return null;
  const idx = Math.floor(Math.random() * localCharacters.length);
  return localCharacters[idx];
}

// Fetch a list of characters from AniList API based on a search letter and page number
async function queryCharactersFromAniList(searchChar, pageNum) {
  const query = `
    query ($search: String, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        characters(search: $search) {
          name { full }
          image { large }
        }
      }
    }
  `;

  try {
    const response = await axios.post('https://graphql.anilist.co', {
      query,
      variables: {
        search: searchChar,
        page: pageNum,
        perPage: 10
      }
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    return response.data.data.Page.characters || [];
  } catch (err) {
    console.warn('⚠️ Failed to fetch from AniList API:', err.message);
    return [];
  }
}

// Try to get a unique character from the AniList API that does not exist locally
async function getUniqueCharacterFromAPI(maxAttempts = 5) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const randomChar = alphabet[Math.floor(Math.random() * alphabet.length)];
    const randomPage = Math.floor(Math.random() * 5) + 1;
    const candidates = await queryCharactersFromAniList(randomChar, randomPage);

    if (!candidates.length) continue;

    // Filter out characters already in the local JSON file
    const uniqueCandidates = candidates.filter(c => 
      !existingCharacterNames.has(c.name.full.toLowerCase())
    );

    if (uniqueCandidates.length === 0) continue;

    // Return one random unique character
    return uniqueCandidates[Math.floor(Math.random() * uniqueCandidates.length)];
  }

  // If no unique character was found after all attempts
  return null;
}

// Main function to retrieve a random character, either from API or local data
async function getRandomCharacter() {
  // 50% chance to try fetching from API first
  const tryAPI = Math.random() < 0.5;

  if (tryAPI) {
    const apiCharacter = await getUniqueCharacterFromAPI();
    if (apiCharacter && apiCharacter.name?.full && apiCharacter.image?.large) {
      return apiCharacter;
    }
    // If API fails or no unique character, fall back to local
  }

  // Return a local character if available
  const localChar = pickRandomLocalCharacter();
  if (localChar) return localChar;

  // Last resort: a placeholder character
  return {
    name: 'Unknown Character',
    image: 'https://via.placeholder.com/300?text=No+Character+Found'
  };
}

// On bot startup: register the slash command /rounds
client.once('ready', async () => {
  const roundsCommand = new SlashCommandBuilder()
    .setName('rounds')
    .setDescription('Start a guessing game with multiple rounds');

  await client.application.commands.create(roundsCommand);
  console.log(`🤖 Bot is online as ${client.user.tag}`);
});

// Listen for text command 'mguess' to manually start a guessing game round
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content.toLowerCase() === 'mguess') {
    const character = await getRandomCharacter();
    if (!character) return message.channel.send('❌ Could not get a character.');

    const answer = character?.name?.full?.toLowerCase() || '';


    const embed = new EmbedBuilder()
      .setTitle('🎯 Guess the anime character!')
      .setImage(character.image.large)
      .setFooter({ text: 'You have 30 seconds to answer!' });

    const sentMsg = await message.channel.send({ embeds: [embed] });
    const collector = message.channel.createMessageCollector({ time: 30000 });

    let answeredCorrectly = false;

    collector.on('collect', msg => {
      if (msg.content.toLowerCase().includes(answer)) {
        answeredCorrectly = true;
        msg.reply(`🎉 Congrats, **${msg.author.username}**! You guessed correctly: **${character.name.full}**`);
        collector.stop();
      }
    });

    collector.on('end', () => {
      if (!answeredCorrectly) {
        sentMsg.reply(`⏰ Time's up! The answer was: **${character.name.full}**`);
      }
    });
  }
});

// Handle slash command interactions and UI interactions for rounds game
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand() && interaction.commandName === 'rounds') {
    // Show a button to start rounds
    const startButton = new ButtonBuilder()
      .setCustomId('start_rounds')
      .setLabel('Start Rounds')
      .setStyle(ButtonStyle.Primary);

    const actionRow = new ActionRowBuilder().addComponents(startButton);

    await interaction.reply({ content: 'Click the button below to start the guessing game rounds!', components: [actionRow] });
  }

  if (interaction.isButton() && interaction.customId === 'start_rounds') {
    // Show a modal to ask how many rounds
    const roundsModal = new ModalBuilder()
      .setCustomId('rounds_modal')
      .setTitle('Configure Number of Rounds');

    const roundsInput = new TextInputBuilder()
      .setCustomId('rounds_input')
      .setLabel('Number of rounds (1 to 10)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const inputRow = new ActionRowBuilder().addComponents(roundsInput);
    roundsModal.addComponents(inputRow);

    await interaction.showModal(roundsModal);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'rounds_modal') {
    const roundsValue = parseInt(interaction.fields.getTextInputValue('rounds_input'));

    if (isNaN(roundsValue) || roundsValue < 1 || roundsValue > 10) {
      return interaction.reply({ content: '❌ Please enter a valid number between 1 and 10.', ephemeral: true });
    }

    await interaction.reply({ content: `🎮 Starting ${roundsValue} round(s) of guessing!` });

    for (let round = 1; round <= roundsValue; round++) {
      const char = await getRandomCharacter();
      if (!char) {
        await interaction.followUp('⚠️ Unable to fetch character for this round.');
        continue;
      }

      const correctAnswer = char.name.full.toLowerCase();

      const embed = new EmbedBuilder()
        .setTitle(`🎯 Round ${round}: Guess the character`)
        .setImage(char.image.large)
        .setFooter({ text: 'You have 30 seconds!' });

      const roundMessage = await interaction.followUp({ embeds: [embed], fetchReply: true });
      const collector = roundMessage.channel.createMessageCollector({ time: 30000 });
      let correctGuess = false;

      collector.on('collect', msg => {
        if (msg.content.toLowerCase().includes(correctAnswer)) {
          correctGuess = true;
          msg.reply(`🎉 Well done, ${msg.author}! That's correct: **${char.name.full}**`);
          collector.stop();
        }
      });

      // Wait until collector ends before proceeding
      await new Promise(resolve => collector.on('end', resolve));

      if (!correctGuess) {
        roundMessage.reply(`⏰ Round over! The correct answer was: **${char.name.full}**`);
      }
    }
  }
});

// Start the bot with your token from .env file
client.login('MTMzODgzMDQzODMxOTUyNTkzMA.G_JAK-.qMj7L3w-yDVnAp8x5MwMxEi4Kq8zwx-eH29_mA');
