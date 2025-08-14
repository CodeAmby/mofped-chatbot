# MoFPED Chatbot Deployment Guide

## 🚀 Free Production Deployment

### 1. Vercel Deployment (Recommended)

#### Prerequisites
- GitHub account
- Vercel account (free tier)
- Supabase account (free tier)

#### Steps

1. **Push to GitHub**
   ```bash
   git remote add origin https://github.com/yourusername/mofped-chatbot.git
   git push -u origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Configure environment variables:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
     SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
     OPENAI_API_KEY=your_openai_api_key
     ```
   - Deploy

3. **Get Production URL**
   - Your chatbot will be available at: `https://mofped-chatbot.vercel.app`

### 2. Supabase Setup

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create new project
   - Note down URL and API keys

2. **Run Database Migrations**
   ```bash
   npm run prisma:migrate
   npm run prisma:generate
   ```

3. **Populate Data**
   ```bash
   npm run populate-comprehensive
   ```

## 🔧 Embedding on Main Website

### Option 1: Simple Script Tag

Add this to your main website's `<head>` section:

```html
<script src="https://mofped-chatbot.vercel.app/embed.js" async></script>
```

### Option 2: Custom Configuration

```html
<script>
  window.MoFPEDChatConfig = {
    apiUrl: 'https://mofped-chatbot.vercel.app/api/ask',
    position: 'bottom-right',
    primaryColor: '#103B73',
    secondaryColor: '#2E7D32'
  };
</script>
<script src="https://mofped-chatbot.vercel.app/embed.js" async></script>
```

### Option 3: React Component (if using React)

```jsx
import ChatWidget from 'https://mofped-chatbot.vercel.app/components/ChatWidget';

function App() {
  return (
    <div>
      {/* Your existing content */}
      <ChatWidget 
        apiUrl="https://mofped-chatbot.vercel.app/api/ask"
        position="bottom-right"
        primaryColor="#103B73"
        secondaryColor="#2E7D32"
      />
    </div>
  );
}
```

## 📊 Analytics Setup

### 1. Vercel Analytics (Automatic)
- Analytics are automatically enabled with Vercel deployment
- View at: `https://vercel.com/your-project/analytics`

### 2. Google Analytics (Optional)
Add to your main website:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

### 3. Analytics Dashboard
Access the analytics dashboard at:
`https://mofped-chatbot.vercel.app/analytics`

## 🛡️ Security & Compliance

### Security Features Implemented
- ✅ Rate limiting (30 requests/minute per IP)
- ✅ Input validation and sanitization
- ✅ CORS protection
- ✅ Security headers (CSP, XSS protection, etc.)
- ✅ SQL injection prevention
- ✅ XSS attack prevention

### Compliance Features
- ✅ Request logging for audit trails
- ✅ Data retention policies
- ✅ Privacy-compliant analytics
- ✅ Secure data transmission (HTTPS)

### Environment Variables Required
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Optional: Google Analytics
NEXT_PUBLIC_GA_ID=your_ga_id
```

## 📈 Monitoring & Optimization

### 1. Performance Monitoring
- Response times tracked automatically
- Popular queries identified
- User interaction patterns analyzed

### 2. Usage Optimization
- Monitor popular queries to improve responses
- Track external link clicks to optimize navigation
- Analyze document relevance scores

### 3. Content Updates
- Add new documents using the ingestion scripts
- Update external system links as needed
- Modify conversational flows based on user feedback

## 🔄 Maintenance

### Regular Tasks
1. **Weekly**: Check analytics dashboard
2. **Monthly**: Update document database
3. **Quarterly**: Review and optimize responses
4. **Annually**: Security audit and compliance review

### Update Process
1. Make changes locally
2. Test thoroughly
3. Push to GitHub
4. Vercel automatically redeploys
5. Test production deployment

## 🆘 Troubleshooting

### Common Issues

1. **Widget not loading**
   - Check CORS settings
   - Verify API URL is correct
   - Check browser console for errors

2. **Slow responses**
   - Check Supabase connection
   - Verify OpenAI API key
   - Monitor rate limits

3. **Analytics not working**
   - Check Vercel Analytics setup
   - Verify Google Analytics ID
   - Check browser console for errors

### Support
- Check Vercel logs: `vercel logs`
- Monitor Supabase dashboard
- Review browser developer tools

## 📞 Contact

For technical support or questions:
- Email: [your-email@domain.com]
- GitHub Issues: [repository-url]/issues
- Documentation: [your-docs-url]
