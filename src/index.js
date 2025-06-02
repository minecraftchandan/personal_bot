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

const existingCharacterNames = new Set(localCharacters.map(c => c.name.toLowerCase()));

function pickRandomLocalCharacter() {
  if (localCharacters.length === 0) return null;
  const idx = Math.floor(Math.random() * localCharacters.length);
  return localCharacters[idx];
}

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

async function getUniqueCharacterFromAPI(maxAttempts = 5) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const randomChar = alphabet[Math.floor(Math.random() * alphabet.length)];
    const randomPage = Math.floor(Math.random() * 5) + 1;
    const candidates = await queryCharactersFromAniList(randomChar, randomPage);

    if (!candidates.length) continue;

    const uniqueCandidates = candidates.filter(c =>
      !existingCharacterNames.has(c.name.full.toLowerCase())
    );

    if (uniqueCandidates.length === 0) continue;

    return uniqueCandidates[Math.floor(Math.random() * uniqueCandidates.length)];
  }
  return null;
}

function normalizeCharacter(character) {
  if (!character) return null;

  if (character.name && typeof character.name === 'object' && character.name.full &&
      character.image && typeof character.image === 'object' && character.image.large) {
    return {
      name: character.name.full,
      image: character.image.large
    };
  }

  if (typeof character.name === 'string' && typeof character.image === 'string') {
    return {
      name: character.name,
      image: character.image
    };
  }
  return null;
}

async function getRandomCharacter() {
  const tryAPI = Math.random() < 0.5;

  if (tryAPI) {
    const apiCharacter = await getUniqueCharacterFromAPI();
    if (apiCharacter && apiCharacter.name?.full && apiCharacter.image?.large) {
      return apiCharacter;
    }
  }

  const localChar = pickRandomLocalCharacter();
  if (localChar) return localChar;

  return {
    name: 'Unknown Character',
    image: 'https://via.placeholder.com/300?text=No+Character+Found'
  };
}

// --- Cooldown and concurrency control ---
// Changed cooldown to 5 seconds (5000 ms)
const cooldownMs = 5 * 1000; // 5 seconds cooldown
const channelCooldowns = new Map();  // channelId => timestamp when cooldown ends
const activeGames = new Set();       // channelId set for active game in that channel

function isOnCooldown(channelId) {
  const now = Date.now();
  return channelCooldowns.has(channelId) && channelCooldowns.get(channelId) > now;
}

function setCooldown(channelId) {
  channelCooldowns.set(channelId, Date.now() + cooldownMs);
}

// Register slash command on bot ready
client.once('ready', async () => {
  const roundsCommand = new SlashCommandBuilder()
    .setName('rounds')
    .setDescription('Start a guessing game with multiple rounds');

  await client.application.commands.create(roundsCommand);
  console.log(`🤖 Bot is online as ${client.user.tag}`);
});

// Handle message command 'mguess'
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (message.content.toLowerCase() !== 'mguess') return;

  const channelId = message.channel.id;

  if (activeGames.has(channelId)) {
    return message.channel.send('⏳ A game is already running in this channel. Please wait for it to finish.');
  }

  if (isOnCooldown(channelId)) {
    return message.channel.send('⏱️ Please wait a bit before starting a new game.');
  }

  activeGames.add(channelId);
  setCooldown(channelId);

  try {
    const rawCharacter = await getRandomCharacter();
    const character = normalizeCharacter(rawCharacter);
    if (!character) {
      await message.channel.send('❌ Could not get a valid character.');
      return;
    }

    const answer = character.name.toLowerCase();

    const embed = new EmbedBuilder()
      .setTitle('🎯 Guess the anime character!')
      .setImage(character.image)
      .setFooter({ text: 'You have 30 seconds to answer!' });

    const sentMsg = await message.channel.send({ embeds: [embed] });
    const collector = message.channel.createMessageCollector({ time: 30000 });

    let answeredCorrectly = false;

    collector.on('collect', msg => {
      if (msg.content.toLowerCase().includes(answer)) {
        answeredCorrectly = true;
        msg.reply(`🎉 Congrats, **${msg.author.username}**! You guessed correctly: **${character.name}**`);
        collector.stop();
      }
    });

    collector.on('end', () => {
      if (!answeredCorrectly) {
        sentMsg.reply(`⏰ Time's up! The answer was: **${character.name}**`);
      }
      activeGames.delete(channelId);
    });

  } catch (err) {
    activeGames.delete(channelId);
    console.error('Error during mguess game:', err);
    message.channel.send('❌ An error occurred while running the game.');
  }
});

// Handle slash command and interactions for /rounds
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand() && interaction.commandName === 'rounds') {
    const channelId = interaction.channelId;

    if (activeGames.has(channelId)) {
      return interaction.reply({ content: '⏳ A game is already running in this channel. Please wait for it to finish.', ephemeral: true });
    }

    if (isOnCooldown(channelId)) {
      return interaction.reply({ content: '⏱️ Please wait a bit before starting a new game.', ephemeral: true });
    }

    // Show start button to configure rounds
    const startButton = new ButtonBuilder()
      .setCustomId('start_rounds')
      .setLabel('Start Rounds')
      .setStyle(ButtonStyle.Primary);

    const actionRow = new ActionRowBuilder().addComponents(startButton);

    await interaction.reply({ content: 'Click the button below to start the guessing game rounds!', components: [actionRow] });
  }

  else if (interaction.isButton() && interaction.customId === 'start_rounds') {
    // Show modal to input number of rounds
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

  else if (interaction.isModalSubmit() && interaction.customId === 'rounds_modal') {
    const channelId = interaction.channelId;

    if (activeGames.has(channelId)) {
      return interaction.reply({ content: '⏳ A game is already running in this channel. Please wait for it to finish.', ephemeral: true });
    }

    if (isOnCooldown(channelId)) {
      return interaction.reply({ content: '⏱️ Please wait a bit before starting a new game.', ephemeral: true });
    }

    const roundsValue = parseInt(interaction.fields.getTextInputValue('rounds_input'));

    if (isNaN(roundsValue) || roundsValue < 1 || roundsValue > 10) {
      return interaction.reply({ content: '❌ Please enter a valid number between 1 and 10.', ephemeral: true });
    }

    activeGames.add(channelId);
    setCooldown(channelId);

    await interaction.reply({ content: `🎮 Starting ${roundsValue} round(s) of guessing!` });

    try {
      for (let round = 1; round <= roundsValue; round++) {
        const rawChar = await getRandomCharacter();
        const char = normalizeCharacter(rawChar);

        if (!char) {
          await interaction.followUp('⚠️ Unable to fetch character for this round.');
          continue;
        }

        const correctAnswer = char.name.toLowerCase();

        const embed = new EmbedBuilder()
          .setTitle(`🎯 Round ${round}: Guess the character`)
          .setImage(char.image)
          .setFooter({ text: 'You have 30 seconds!' });

        const roundMessage = await interaction.followUp({ embeds: [embed], fetchReply: true });
        const collector = roundMessage.channel.createMessageCollector({ time: 30000 });
        let correctGuess = false;

        collector.on('collect', msg => {
          if (msg.content.toLowerCase().includes(correctAnswer)) {
            correctGuess = true;
            msg.reply(`🎉 Well done, ${msg.author}! That's correct: **${char.name}**`);
            collector.stop();
          }
        });

        // Wait until collector ends before continuing to next round
        await new Promise(resolve => collector.on('end', resolve));

        if (!correctGuess) {
          roundMessage.reply(`⏰ Round over! The correct answer was: **${char.name}**`);
        }
      }
    } catch (err) {
      console.error('Error during rounds game:', err);
      interaction.followUp('❌ An error occurred while running the rounds game.');
    } finally {
      activeGames.delete(channelId);
    }
  }
});

// Login with your bot token
client.login(process.env.DISCORD_TOKEN);
