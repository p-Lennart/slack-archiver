const { jml, jml_nester } = await import('./jml.mjs');

export function dateWidgetUI(dir, messages, dobj_end, dobj_start) {
    const data = dateWidgetData(messages, dobj_end, dobj_start);

    const nodes = [];

    for (const [yearNum, [months, yearly]] of Object.entries(data)) {
        let yearTitle = jml('button', { class: 'collapse_trigger', id: 'dNW_yearTitle' + yearNum, onClick: function() {
            toggleCollapse(this);
        }, }, 
            jml('h2', {}, [
                jml('span', { id: 'dNW_yearTitle' + yearNum + 'Max' }, yearNum),
                jml('span', { id: 'dNW_yearTitle' + yearNum + 'Min' }, [
                    jml('span', {}, yearNum + ': '),
                    jml('span', { class: 'accent' }, `${yearly} Messages`),
                ]),
            ]),
        );
        
        let yearContent = jml('ul', { class: 'collapse_content', id: 'dNW_yearContent' + yearNum });
        
        for (const [monthNum, [days, monthly]] of Object.entries(months)) {

            let monthName = ["January", "Febuary", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][monthNum];
            
            let monthTitle = jml('button', { class: 'collapse_trigger', id: 'dNW_monthTitle' + monthNum, onClick: function() {
                toggleCollapse(this);
            }, },    
                jml('h3', {}, [
                    jml('span', { id: 'dNW_monthTitle' + monthNum + 'Max' }, monthName),
                    jml('span', { id: 'dNW_monthTitle' + monthNum + 'Min' }, [
                        jml('span', {}, monthName + ': '),
                        jml('span', { class: 'accent' }, `${monthly} Messages`),
                    ]),
                ]),
            );

            let monthContent = jml('ol', { class: 'collapse_content', id: 'dNW_monthContent' + monthNum });

            for (const [dayNum, [dayObj, messages]] of Object.entries(days)) {
                let dayDateStr = dayObj.toString();
                
                let dayNode = jml('li', { value: dayNum }, 
                    jml('a', { href: `./viewer.htm?type=${params.type}&id=${params.id}&ts=${dayObj.getTime() / 1000}` }, [
                        jml('span', {}, `${dayDateStr.slice(0, 3)}: `),
                        jml('span', { class: 'accent' }, `${messages} Messages`),
                    ])
                );
                
                jml_nester(monthContent, dayNode);

            }

            jml_nester(yearContent, jml('li', {}, monthTitle));
            jml_nester(yearContent, monthContent);

        }
        
        nodes.push(yearTitle);
        nodes.push(yearContent);
        
    }
    
    return nodes;

}

function dateWidgetData(messages, dobj_end, dobj_start) {
    const result = {};

    for (var i = 0; i <= dobj_start.getFullYear() - dobj_end.getFullYear(); i++) {
        const months = {};
        var yearly = 0;
        
        var firstMonth = 0;
        var lastMonth = 11;
        
        if (i === 0) firstMonth = dobj_end.getMonth();
        if (i === dobj_start.getFullYear() - dobj_end.getFullYear()) lastMonth = dobj_start.getMonth();


        for (var j = firstMonth; j <= lastMonth; j++) {
            const days = {};
            var monthly = 0;

            let d = new Date(dobj_end.getFullYear() + i, j + 1, 0);
            let numOfDays = d.getDate();
            
            for (var k = 1; k <= numOfDays; k++) {
                d.setDate(k);
                
                let d_ = new Date(d); 
                d_.setDate(k + 1);
                
                let daily = getMessagesInSpan(messages, d.getTime(), d_.getTime());
                if (daily && daily.length > 0) {
                    days[k] = [new Date(d), daily.length];
                    monthly += daily.length;
                }
            }
            months[j] = [days, monthly];
            yearly += monthly;
        }

        result[dobj_end.getFullYear() + i] = [months, yearly];
    }

    return result;
    
}
