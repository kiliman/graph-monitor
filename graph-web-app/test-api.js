async function testAPI() {
  try {
    // Test with key=all
    const url1 = 'http://localhost:3001/api/metrics/latest?key=all&name=status&limit=10';
    console.log('Testing:', url1);
    const response1 = await fetch(url1);
    const data1 = await response1.json();
    console.log('Response status:', response1.status);
    console.log('Data length:', data1.length);
    console.log('Data:', JSON.stringify(data1.slice(0, 3), null, 2));
    
    console.log('\n---\n');
    
    // Test with specific key
    const url2 = 'http://localhost:3001/api/metrics/latest?key=google&name=status&limit=10';
    console.log('Testing:', url2);
    const response2 = await fetch(url2);
    const data2 = await response2.json();
    console.log('Response status:', response2.status);
    console.log('Data length:', data2.length);
    console.log('Data:', JSON.stringify(data2.slice(0, 3), null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testAPI();