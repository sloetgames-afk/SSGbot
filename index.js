import { 
    Client, GatewayIntentBits, Partials, EmbedBuilder, ChannelType, 
    PermissionsBitField, AuditLogEvent, ActivityType 
} from 'discord.js';
import * as dotenv from 'dotenv';
import Database from 'better-sqlite3';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessageReactions, 
        GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User]
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const db = new Database('sgames_professional.sqlite');
const COLOR_NARANJA = 0xFF8C00;

// CONFIGURACIÓN DE APIs GROQ
const GROQ_APIS = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY2,
    process.env.GROQ_API_KEY3,
    process.env.GROQ_API_KEY4,
    process.env.GROQ_API_KEY5
].filter(Boolean);

let currentApiIndex = 0;

// Tabla para almacenar configuraciones
db.exec(`
    CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT
    );
`);

// BASE DE DATOS
db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (user_id TEXT PRIMARY KEY, xp INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS starboard (msg_id TEXT PRIMARY KEY, star_id TEXT);
    CREATE TABLE IF NOT EXISTS dm_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        role TEXT,
        message TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS user_rate_limit (
        user_id TEXT PRIMARY KEY,
        message_count INTEGER DEFAULT 0,
        limit_until DATETIME,
        timer_message_id TEXT
    );
`);

// MAPEO DE RANGOS
const RANGOS = [
    { id: process.env.ROL_NOVATO_I, xp: 1, name: "Novato I" },
    { id: process.env.ROL_NOVATO_II, xp: 30, name: "Novato II" },
    { id: process.env.ROL_NOVATO_III, xp: 80, name: "Novato III" },
    { id: process.env.ROL_NOVATO_IV, xp: 150, name: "Novato IV" },
    { id: process.env.ROL_NOVATO_V, xp: 250, name: "Novato V" },
    { id: process.env.ROL_PLATA_I, xp: 400, name: "Plata I" },
    { id: process.env.ROL_PLATA_II, xp: 600, name: "Plata II" },
    { id: process.env.ROL_PLATA_III, xp: 900, name: "Plata III" },
    { id: process.env.ROL_PLATA_IV, xp: 1300, name: "Plata IV" },
    { id: process.env.ROL_PLATA_V, xp: 1800, name: "Plata V" },
    { id: process.env.ROL_ORO_I, xp: 2500, name: "Oro I" },
    { id: process.env.ROL_ORO_II, xp: 3300, name: "Oro II" },
    { id: process.env.ROL_ORO_III, xp: 4200, name: "Oro III" },
    { id: process.env.ROL_ORO_IV, xp: 5200, name: "Oro IV" },
    { id: process.env.ROL_ORO_V, xp: 6300, name: "Oro V" },
    { id: process.env.ROL_LEYENDA_I, xp: 8000, name: "Leyenda I" },
    { id: process.env.ROL_LEYENDA_II, xp: 10000, name: "Leyenda II" },
    { id: process.env.ROL_LEYENDA_III, xp: 12500, name: "Leyenda III" },
    { id: process.env.ROL_LEYENDA_IV, xp: 15500, name: "Leyenda IV" },
    { id: process.env.ROL_LEYENDA_V, xp: 20000, name: "Leyenda V" }
];

// 5. STARBOARD (SISTEMA DE CATEGORÍA & ACTUALIZACIÓN REAL)
client.on('messageReactionAdd', async (reaction, user) => {
    if (reaction.emoji.name !== '⭐' || user.bot) return;

    if (reaction.partial) {
        try { await reaction.fetch(); } catch (e) { return; }
    }

    const { message } = reaction;

    // FILTRO DINÁMICO: Solo canales dentro de la CATEGORIA_SUGESTION_ID o el propio TOP
    const isVotacion = message.channel.parentId === process.env.CATEGORIA_SUGESTION_ID;
    const isTop = message.channel.id === process.env.CANAL_TOP_SUGESTION_ID;

    if (!isVotacion && !isTop) return;

    const topChannel = message.guild.channels.cache.get(process.env.CANAL_TOP_SUGESTION_ID);
    if (!topChannel) return;

    // Obtener datos cruzados de la DB
    let entry = isTop 
        ? db.prepare('SELECT msg_id, star_id FROM starboard WHERE star_id = ?').get(message.id)
        : db.prepare('SELECT star_id FROM starboard WHERE msg_id = ?').get(message.id);

    let totalStars = 0;
    let originalMsg = null;

    try {
        // Encontrar mensaje original para contar votos y sacar datos
        if (isTop && entry) {
            const catChannels = message.guild.channels.cache.filter(c => c.parentId === process.env.CATEGORIA_SUGESTION_ID);
            for (const [id, chan] of catChannels) {
                originalMsg = await chan.messages.fetch(entry.msg_id).catch(() => null);
                if (originalMsg) break;
            }
        } else if (!isTop) {
            originalMsg = message;
        }

        // Sumar votos del original + votos del Top
        const starsInOriginal = originalMsg?.reactions.cache.get('⭐')?.count || 0;
        let starsInTop = 0;
        if (entry || isTop) {
            const topMsgId = isTop ? message.id : entry.star_id;
            const starMsg = await topChannel.messages.fetch(topMsgId).catch(() => null);
            starsInTop = starMsg?.reactions.cache.get('⭐')?.count || 0;
        }
        totalStars = starsInOriginal + starsInTop;
    } catch (e) { console.error("Error sumando votos:", e); }

    if (!originalMsg) return;

    const starEmbed = new EmbedBuilder()
        .setColor(COLOR_NARANJA)
        .setAuthor({ 
            name: originalMsg.author.username, 
            iconURL: originalMsg.author.displayAvatarURL({ dynamic: true }) 
        })
        .setDescription(originalMsg.content || "*(Imagen/Contenido)*")
        .addFields(
            { name: '⭐ Votos Totales', value: `**${totalStars}**`, inline: true },
            { name: '📍 Canal', value: `<#${originalMsg.channel.id}>`, inline: true },
            { name: '📅 Registro', value: `\`${new Date().toLocaleString()}\``, inline: false }
        )
        .setFooter({ text: `ID: ${originalMsg.author.id}` });

    if (originalMsg.attachments.size > 0) {
        starEmbed.setImage(originalMsg.attachments.first().url);
    }

    // Editar o Crear
    if (entry || isTop) {
        const msgToEditId = isTop ? message.id : entry.star_id;
        const msgToEdit = await topChannel.messages.fetch(msgToEditId).catch(() => null);
        if (msgToEdit) await msgToEdit.edit({ embeds: [starEmbed] });
    } else if (totalStars >= 25) {
        const sent = await topChannel.send({ embeds: [starEmbed] });
        db.prepare('INSERT INTO starboard (msg_id, star_id) VALUES (?, ?)').run(originalMsg.id, sent.id);
    }
});

// BIENVENIDAS
client.on('guildMemberAdd', async (member) => {
    const channel = member.guild.channels.cache.get(process.env.CANAL_BIENVENIDA_ID);
    if (!channel) return;
    const embed = new EmbedBuilder()
        .setColor(COLOR_NARANJA)
        .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
        .setTitle("Está aquí")
        .setDescription("Bienvenido a nuestro servidor. Si tienes algún problema no dudes en consultar con nuestro equipo de soporte técnico.")
        .setFooter({ text: `Miembro #${member.guild.memberCount}` });
    channel.send({ content: `¡Hola ${member}!`, embeds: [embed] });
});

// FUNCIÓN DE RATE LIMIT
function checkRateLimit(userId) {
    const limit = db.prepare('SELECT message_count, limit_until FROM user_rate_limit WHERE user_id = ?').get(userId);
    
    if (!limit) {
        db.prepare('INSERT INTO user_rate_limit (user_id, message_count) VALUES (?, 0)').run(userId);
        return { allowed: true, count: 0 };
    }

    const now = new Date();
    const limitUntil = limit.limit_until ? new Date(limit.limit_until) : null;

    // Si ya no está en límite
    if (limitUntil && now > limitUntil) {
        db.prepare('UPDATE user_rate_limit SET message_count = 0, limit_until = NULL, timer_message_id = NULL WHERE user_id = ?').run(userId);
        return { allowed: true, count: 0 };
    }

    // Si está en límite
    if (limitUntil) {
        return { allowed: false, limitUntil, count: limit.message_count };
    }

    return { allowed: true, count: limit.message_count };
}

function incrementMessageCount(userId) {
    const current = db.prepare('SELECT message_count FROM user_rate_limit WHERE user_id = ?').get(userId);
    const newCount = (current?.message_count || 0) + 1;
    
    db.prepare('UPDATE user_rate_limit SET message_count = ? WHERE user_id = ?').run(newCount, userId);

    if (newCount >= 50) {
        const limitUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos
        db.prepare('UPDATE user_rate_limit SET limit_until = ? WHERE user_id = ?').run(limitUntil.toISOString(), userId);
        return { limited: true, limitUntil };
    }

    return { limited: false };
}

// MENSAJES, TICKETS Y RANGOS
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.channel.type === ChannelType.DM) {
        try {
            // Verificar rate limit
            const rateLimitCheck = checkRateLimit(message.author.id);
            
            if (!rateLimitCheck.allowed) {
                const limitUntil = new Date(rateLimitCheck.limitUntil);
                const timerMsg = await message.reply({
                    content: `⏱️ **Has alcanzado el límite de uso diario. Puedes seguir enviando mensajes después de 30 minutos.**\n\n⏰ Tiempo restante: **30:00**`
                });

                // Guardar ID del mensaje para editarlo
                db.prepare('UPDATE user_rate_limit SET timer_message_id = ? WHERE user_id = ?').run(timerMsg.id, message.author.id);

                // Actualizar el timer cada segundo
                const timerInterval = setInterval(async () => {
                    const now = new Date();
                    const timeLeft = limitUntil - now;
                    
                    if (timeLeft <= 0) {
                        clearInterval(timerInterval);
                        db.prepare('UPDATE user_rate_limit SET message_count = 0, limit_until = NULL, timer_message_id = NULL WHERE user_id = ?').run(message.author.id);
                        await timerMsg.edit({ content: `✅ **¡Tu límite ha sido reiniciado!** Ahora puedes volver a escribir.` }).catch(() => {});
                        return;
                    }

                    const minutes = Math.floor(timeLeft / 60000);
                    const seconds = Math.floor((timeLeft % 60000) / 1000);
                    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

                    await timerMsg.edit({ 
                        content: `⏱️ **Has alcanzado el límite de uso diario. Puedes seguir enviando mensajes después de 30 minutos.**\n\n⏰ Tiempo restante: **${timeStr}**` 
                    }).catch(() => {});
                }, 1000);

                return;
            }

            // Guardar mensaje del usuario en historial
            db.prepare(`
                INSERT INTO dm_history (user_id, role, message) 
                VALUES (?, 'user', ?)
            `).run(message.author.id, message.content);

            // Incrementar contador de mensajes
            const limitResult = incrementMessageCount(message.author.id);

            // Si se alcanzó el límite AHORA, mostrar timer
            if (limitResult.limited) {
                const limitUntil = new Date(Date.now() + 30 * 60 * 1000);
                const timerMsg = await message.reply({
                    content: `⏱️ **Has alcanzado el límite de uso diario. Puedes seguir enviando mensajes después de 30 minutos.**\n\n⏰ Tiempo restante: **30:00**`
                });

                // Guardar ID del mensaje para editarlo
                db.prepare('UPDATE user_rate_limit SET timer_message_id = ? WHERE user_id = ?').run(timerMsg.id, message.author.id);

                // Actualizar el timer cada segundo
                const timerInterval = setInterval(async () => {
                    const now = new Date();
                    const timeLeft = limitUntil - now;
                    
                    if (timeLeft <= 0) {
                        clearInterval(timerInterval);
                        db.prepare('UPDATE user_rate_limit SET message_count = 0, limit_until = NULL, timer_message_id = NULL WHERE user_id = ?').run(message.author.id);
                        await timerMsg.edit({ content: `✅ **¡Tu límite ha sido reiniciado!** Ahora puedes volver a escribir.` }).catch(() => {});
                        return;
                    }

                    const minutes = Math.floor(timeLeft / 60000);
                    const seconds = Math.floor((timeLeft % 60000) / 1000);
                    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

                    await timerMsg.edit({ 
                        content: `⏱️ **Has alcanzado el límite de uso diario. Puedes seguir enviando mensajes después de 30 minutos.**\n\n⏰ Tiempo restante: **${timeStr}**` 
                    }).catch(() => {});
                }, 1000);

                return;
            }

            // Obtener historial de conversación
            const history = db.prepare(`
                SELECT role, message FROM dm_history 
                WHERE user_id = ? 
                ORDER BY id DESC LIMIT 20
            `).all(message.author.id).reverse();

            // Construir contexto de conversación
            const messages = history.map(h => ({
                role: h.role,
                content: h.message
            }));

            // Verificar si pregunta sobre el desarrollador
            if (isDeveloperQuestion(message.content)) {
                const devResponse = `Fui desarrollado por **Sloet Games Tecnologie**. Somos un equipo dedicado a crear experiencias de gaming y herramientas innovadoras para nuestra comunidad. 🎮`;
                
                db.prepare(`
                    INSERT INTO dm_history (user_id, role, message) 
                    VALUES (?, 'assistant', ?)
                `).run(message.author.id, devResponse);

                await message.reply(devResponse);
                return;
            }

            // Llamar a API de Groq para obtener respuesta de IA
            const groqResponse = await callLLM(messages);

            if (!groqResponse) {
                return message.reply("⚠️ **Límite de tokens alcanzado.**\n\nTodas nuestras APIs de Groq han alcanzado su límite diario. Por favor, intenta en aproximadamente **20-30 minutos** cuando se reinicie el límite. Disculpa las molestias.");
            }

            // Guardar respuesta de IA en historial
            db.prepare(`
                INSERT INTO dm_history (user_id, role, message) 
                VALUES (?, 'assistant', ?)
            `).run(message.author.id, groqResponse);

            // Enviar respuesta única
            await message.reply(groqResponse);
        } catch (error) {
            console.error('Error en DM:', error.message);
            message.reply("⚠️ Ocurrió un problema procesando tu solicitud. Nuestro equipo ha sido notificado.").catch(() => {});
        }
        return;
    }

    if (message.channel.id === process.env.CANAL_CREACION_TICKET_ID) {
        const razon = message.content;
        await message.delete().catch(() => {});
        const tChan = await message.guild.channels.create({
            name: `ticket-${message.author.username}`,
            parent: process.env.CATEGORIA_TICKETS_ID,
            permissionOverwrites: [
                { id: message.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: message.author.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: process.env.ROL_SOPORTE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
        });
        const tEmbed = new EmbedBuilder()
            .setColor(COLOR_NARANJA)
            .setTitle("Soporte Técnico | SGames")
            .setDescription(`Hola ${message.author}, Gracias por ponerte en contacto con nuestro equipo de soporte.

Nuestro equipo revisara tu ticket y te ayudara lo antes posible. Este proceso puede tardar entre 24 a 48 horas.

Si el equipo no llega a responder... Unete al servidor oficial del Soporte SGames.

Enlace: https://discord.gg/2hbJSXjS6n`)
            .addFields({ name: "Motivo", value: razon });
        tChan.send({ content: `<@&${process.env.ROL_SOPORTE_ID}>`, embeds: [tEmbed] });
        return;
    }

    // XP y Rangos
    const uid = message.author.id;
    db.prepare('INSERT OR IGNORE INTO usuarios (user_id) VALUES (?)').run(uid);
    db.prepare('UPDATE usuarios SET xp = xp + 1 WHERE user_id = ?').run(uid);
    const userXP = db.prepare('SELECT xp FROM usuarios WHERE user_id = ?').get(uid).xp;
    const currentRank = [...RANGOS].reverse().find(r => userXP >= r.xp);

    if (currentRank && !message.member.roles.cache.has(currentRank.id)) {
        const allRoleIds = RANGOS.map(r => r.id);
        await message.member.roles.remove(allRoleIds).catch(() => {});
        await message.member.roles.add(currentRank.id).catch(() => {});
        const rankChan = message.guild.channels.cache.get(process.env.CANAL_ANUNCIOS_RANGO_ID);
        if (rankChan) {
            const rankEmbed = new EmbedBuilder()
                .setColor(COLOR_NARANJA)
                .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                .setDescription(`Felicidades ${message.author}. 
Subiste de rango a **${currentRank.name}**.`)
                .setFooter({ text: `SGames System • ${new Date().toLocaleDateString()}` });
            rankChan.send({ embeds: [rankEmbed] });
        }
    }
});

// LOGS
client.on('guildChannelUpdate', async (oldC, newC) => {
    const logs = newC.guild.channels.cache.get(process.env.CANAL_LOGS_STAFF_ID);
    if (!logs) return;
    const audit = await newC.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelUpdate });
    const entry = audit.entries.first();
    if (!entry) return;
    const logEmbed = new EmbedBuilder()
        .setColor(COLOR_NARANJA)
        .setTitle("🛠️ Registro de Staff")
        .setDescription(`El usuario **${entry.executor.tag}** modificó **#${oldC.name}**.`)
        .setTimestamp();
    logs.send({ embeds: [logEmbed] });
});

const app = express();

// Health Check - Para UptimeRobot
app.get('/', (req, res) => {
    res.status(200).json({ status: 'ok', bot: 'SGames Bot Online' });
});

app.listen(process.env.PORT || 5000);

function getEmojiForRango(name) {
    if (name.includes('Novato')) return '🟦';
    if (name.includes('Plata')) return '⬜';
    if (name.includes('Oro')) return '🟨';
    if (name.includes('Leyenda')) return '👑';
    return '⭐';
}

// DETECTAR PREGUNTAS SOBRE EL DESARROLLADOR
function isDeveloperQuestion(content) {
    const developerKeywords = [
        'quién te programó',
        'quién te desarrolló',
        'dónde fuiste programado',
        'quién te creó',
        'quién te hizo',
        'dónde te crearon',
        'quién es tu creador',
        'quién te desarrolló',
        'tu desarrollador',
        'tu programador',
        'tu creador'
    ];
    
    const lowerContent = content.toLowerCase();
    return developerKeywords.some(keyword => lowerContent.includes(keyword));
}

// FUNCIÓN PARA LLAMAR A GROQ API CON ROTACIÓN DE CLAVES
async function callLLM(messages) {
    try {
        if (GROQ_APIS.length === 0) {
            console.error('❌ Sin claves de API Groq configuradas');
            return null;
        }

        if (!messages || messages.length === 0) {
            console.error('❌ Sin mensajes para procesar');
            return null;
        }

        // Intentar con cada API hasta que una funcione
        for (let attempt = 0; attempt < GROQ_APIS.length; attempt++) {
            const apiKey = GROQ_APIS[currentApiIndex];
            console.log(`📡 Intentando con API #${(currentApiIndex + 1)}`);

            try {
                const response = await fetch(
                    'https://api.groq.com/openai/v1/chat/completions',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: 'llama-3.3-70b-versatile',
                            messages: messages.map(m => ({
                                role: m.role === 'assistant' ? 'assistant' : 'user',
                                content: m.content
                            })),
                            temperature: 0.7,
                            max_tokens: 800,
                            top_p: 0.9
                        })
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    const errorMsg = data.error?.message || 'Error desconocido';
                    console.warn(`⚠️ API #${(currentApiIndex + 1)} error (${response.status}): ${errorMsg}`);
                    currentApiIndex = (currentApiIndex + 1) % GROQ_APIS.length;
                    continue;
                }

                if (data.choices?.[0]?.message?.content) {
                    console.log(`✅ Respuesta IA recibida (API #${(currentApiIndex + 1)})`);
                    return data.choices[0].message.content;
                }

                console.warn(`⚠️ Estructura de respuesta inválida. Cambiando API...`);
                console.log(`Respuesta recibida:`, JSON.stringify(data).substring(0, 200));
                currentApiIndex = (currentApiIndex + 1) % GROQ_APIS.length;
                continue;
            } catch (error) {
                console.warn(`⚠️ Error en API #${(currentApiIndex + 1)}: ${error.message}`);
                currentApiIndex = (currentApiIndex + 1) % GROQ_APIS.length;
            }
        }

        console.error('❌ Todas las APIs agotadas o con error');
        return null;
    } catch (error) {
        console.error('Error en llamada a IA:', error.message);
        return null;
    }
}

// Manejo de errores global
process.on('uncaughtException', (err) => {
    console.error('❌ Error no capturado:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promise rechazada no manejada:', reason);
});

client.on('ready', () => {
    console.log(`✅ SGames Bot activo: ${client.user.tag}`);
    console.log(`📡 APIs disponibles: ${GROQ_APIS.length}/10`);
    client.user.setActivity('Real Drive Multiplayer', { type: ActivityType.Competing });
});

client.on('error', (error) => {
    console.error('❌ Error del cliente Discord:', error);
});

client.login(process.env.BOT_TOKEN);
