<%@ page import="investtrckr.Investment" %>



<div class="fieldcontain ${hasErrors(bean: investmentInstance, field: 'name', 'error')} required">
	<label for="name">
		<g:message code="investment.name.label" default="Name" />
		<span class="required-indicator">*</span>
	</label>
	<g:textField name="name" required="" value="${investmentInstance?.name}"/>
</div>

<div class="fieldcontain ${hasErrors(bean: investmentInstance, field: 'tracker', 'error')} required">
	<label for="tracker">
		<g:message code="investment.tracker.label" default="Tracker" />
		<span class="required-indicator">*</span>
	</label>
	<g:textField name="tracker" required="" value="${investmentInstance?.tracker}"/>
</div>

<div class="fieldcontain ${hasErrors(bean: investmentInstance, field: 'purchases', 'error')} ">
	<label for="purchases">
		<g:message code="investment.purchases.label" default="Purchases" />
		
	</label>
	
<ul class="one-to-many">
<g:each in="${investmentInstance?.purchases?}" var="p">
    <li><g:link controller="purchase" action="show" id="${p.id}">${p?.encodeAsHTML()}</g:link></li>
</g:each>
<li class="add">
<g:link controller="purchase" action="create" params="['investment.id': investmentInstance?.id]">${message(code: 'default.add.label', args: [message(code: 'purchase.label', default: 'Purchase')])}</g:link>
</li>
</ul>

</div>

<div class="fieldcontain ${hasErrors(bean: investmentInstance, field: 'sales', 'error')} ">
	<label for="sales">
		<g:message code="investment.sales.label" default="Sales" />
		
	</label>
	
<ul class="one-to-many">
<g:each in="${investmentInstance?.sales?}" var="s">
    <li><g:link controller="sale" action="show" id="${s.id}">${s?.encodeAsHTML()}</g:link></li>
</g:each>
<li class="add">
<g:link controller="sale" action="create" params="['investment.id': investmentInstance?.id]">${message(code: 'default.add.label', args: [message(code: 'sale.label', default: 'Sale')])}</g:link>
</li>
</ul>

</div>

