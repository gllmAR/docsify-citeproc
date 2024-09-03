(function () {
    console.log('Docsify CiteProc Plugin Loaded');
  
    // Load the Citeproc.js library dynamically as a script (UMD version)
    function loadCiteprocJs(callback) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/citeproc@1.1.0/citeproc.min.js';
      script.onload = callback;
      document.head.appendChild(script);
    }
  
    // Function to parse .bib file to JSON
    function parseBibTex(bibContent) {
      const entries = bibContent.split('@').slice(1);
      const bibData = {};
  
      entries.forEach(entry => {
        const [typeAndKey, ...fieldsArray] = entry.split(',');
        const typeAndKeyParts = typeAndKey.trim().split('{');
        const type = typeAndKeyParts[0].trim();
        const key = typeAndKeyParts[1].trim();
  
        const fields = fieldsArray.join(',').replace(/\s+$/g, '').slice(0, -1).split(/,(?![^{]*})/);
  
        const entryData = { id: key, type: type };
  
        fields.forEach(field => {
          const [fieldName, fieldValue] = field.split('=').map(part => part.trim());
          let cleanValue = fieldValue.replace(/^{|}$/g, '').replace(/^"|"$/g, '');
  
          switch (fieldName.toLowerCase()) {
            case 'author':
            case 'editor':
              entryData.author = cleanValue.split(' and ').map(name => {
                const [given, family] = name.trim().split(', ').reverse();
                return { family: family, given: given };
              });
              break;
            case 'title':
              entryData.title = cleanValue;
              break;
            case 'year':
              entryData.issued = { 'date-parts': [[parseInt(cleanValue)]] };
              break;
            case 'publisher':
              entryData.publisher = cleanValue;
              break;
            case 'address':
              entryData['publisher-place'] = cleanValue;
              break;
            case 'journal':
              entryData['container-title'] = cleanValue;
              break;
            case 'volume':
              entryData.volume = cleanValue;
              break;
            case 'number':
              entryData.issue = cleanValue;
              break;
            case 'pages':
              entryData.page = cleanValue;
              break;
            case 'doi':
              entryData.DOI = cleanValue;
              break;
            case 'isbn':
              entryData.ISBN = cleanValue;
              break;
            case 'url':
              entryData.URL = cleanValue;
              break;
            default:
              entryData[fieldName.toLowerCase()] = cleanValue;
          }
        });
  
        bibData[key] = entryData;
        console.log('Parsed entry:', key, entryData);
      });
  
      return bibData;
    }
  
    async function loadFile(filePath) {
      try {
        const response = await fetch(filePath);
        if (!response.ok) {
          throw new Error(`Failed to load ${filePath}: ${response.statusText}`);
        }
        const fileContent = await response.text();
        console.log(`Loaded ${filePath} content:`, fileContent);
        return fileContent;
      } catch (error) {
        console.error(`Error loading file ${filePath}:`, error);
        return null;
      }
    }
  
    function initCiteProcPlugin() {
      window.$docsify.plugins = [].concat(function (hook, vm) {
        hook.beforeEach(async function (content) {
          console.log('Processing content for citations...');
  
          const citationRegex = /\[@([^\]]+)\]/g;
          const citations = {};
          let match;
  
          // Load the .bib file directly
          const bibContent = await loadFile('references.bib');
          if (!bibContent) {
            console.error('No .bib content loaded.');
            return content;
          }
  
          const bibData = parseBibTex(bibContent);
  
          // Check for citation keys in the README.md content
          const readmeContent = await loadFile('README.md');
          if (!readmeContent) {
            console.error('No README.md content loaded.');
            return content;
          }
  
          while ((match = citationRegex.exec(readmeContent)) !== null) {
            const citeKey = match[1];
            if (!citations[citeKey]) {
              citations[citeKey] = null;
              console.log('Found citation key in README.md:', citeKey);
            }
          }
  
          if (Object.keys(citations).length > 0) {
            const sys = {
              retrieveLocale: function () {
                return null;
              },
              retrieveItem: function (id) {
                return citations[id];
              },
            };
  
            const style = new CSL.Engine(sys, 'chicago-author-date');
  
            Object.keys(citations).forEach((key) => {
              citations[key] = bibData[key];
              if (citations[key]) {
                console.log('Mapped citation key to entry:', key, citations[key]);
              } else {
                console.error('Citation key not found in .bib data:', key);
              }
            });
  
            // Replace citations in content
            content = content.replace(citationRegex, function (_, citeKey) {
              const citation = style.makeCitationCluster([{ id: citeKey }]);
              console.log('Generated citation for', citeKey, ':', citation[0][1]);
              return citation[0][1];
            });
  
            // Generate bibliography
            const bibliography = style.makeBibliography()[1].join('\n');
            content += '\n\n## References\n' + bibliography;
            console.log('Generated bibliography:', bibliography);
  
            vm.render(content);
          } else {
            console.warn('No citations found in the README.md content.');
          }
  
          return content;
        });
      }, window.$docsify.plugins);
    }
  
    // Load Citeproc.js and initialize the plugin
    loadCiteprocJs(initCiteProcPlugin);
  })();
  