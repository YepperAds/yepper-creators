// config/passport.js (PostgreSQL - creators)
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const Creator = require('../creators/models/Creator');

passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:  '/api/auth/google/callback',
  proxy:        true,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let creator = await Creator.findByGoogleId(profile.id);

    if (creator) {
      // Update basic profile fields (don't assume gsc token columns exist for creators)
      creator = await Creator.update(creator.id, {
        fullName: profile.displayName,
        avatar: profile.photos[0]?.value || creator.avatar,
      });
      return done(null, creator);
    }

    // Check if account exists with this email
    creator = await Creator.findByEmail(profile.emails[0].value);

    if (creator) {
      creator = await Creator.update(creator.id, {
        googleId: profile.id,
        fullName: profile.displayName,
        avatar: profile.photos[0]?.value || creator.avatar,
      });
      return done(null, creator);
    }

    // New creator
    creator = await Creator.create({
      googleId: profile.id,
      email: profile.emails[0].value,
      fullName: profile.displayName,
      avatar: profile.photos[0]?.value || '',
    });

    done(null, creator);
  } catch (error) {
    done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await Creator.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});
